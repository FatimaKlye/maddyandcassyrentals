"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/ToastProvider";
import Spinner from "@/components/ui/Spinner";
import {
  createCatalogProductAsAdmin,
  deactivateCatalogProductAsAdmin,
  updateCatalogProductAsAdmin,
  uploadCatalogImage,
  type CatalogEditorInput,
} from "@/src/services/productService";
import {
  getAdminCatalog,
  type AdminPriceHistoryEntry,
} from "@/src/services/adminReadService";
import type { Product } from "@/types/product";
import styles from "./catalog.module.css";

const blankForm: CatalogEditorInput = {
  name: "",
  brand: "",
  category: "Phones",
  description: "",
  pricePerDay: 0,
  image: "/images/maddy-cassy-rentals-icon.png",
  included: [],
  totalUnits: 1,
  isActive: true,
};

export default function AdminCatalogManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [form, setForm] = useState<CatalogEditorInput>(blankForm);
  const [includedText, setIncludedText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceHistory, setPriceHistory] = useState<AdminPriceHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const data = await getAdminCatalog(await user.getIdToken());
      setProducts(data.products);
      setPriceHistory(data.priceHistory);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The catalog could not be loaded. Please refresh and try again.",
      );
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openEditor(product?: Product) {
    if (product) {
      setEditing(product);
      setForm({
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        pricePerDay: product.pricePerDay,
        image: product.image,
        included: product.included ?? [],
        totalUnits: product.totalUnits ?? 0,
        isActive: product.isActive,
      });
      setIncludedText((product.included ?? []).join("\n"));
    } else {
      setEditing("new");
      setForm(blankForm);
      setIncludedText("");
    }
    setImageFile(null);
  }

  async function save() {
    if (!user || !editing) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const editorInput = {
        ...form,
        included: includedText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (imageFile) {
        editorInput.image = await uploadCatalogImage(
          editing === "new" ? `draft-${user.uid}` : editing.id,
          imageFile,
        );
      }
      if (editing === "new") {
        await createCatalogProductAsAdmin(editorInput, idToken);
      } else {
        await updateCatalogProductAsAdmin(editing.id, editorInput, idToken);
      }
      await load();
      setEditing(null);
      showToast("Catalog and inventory updated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The product could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(product: Product) {
    if (!user || !window.confirm(`Deactivate ${product.name}? Existing booking records will remain.`)) {
      return;
    }
    try {
      await deactivateCatalogProductAsAdmin(product.id, await user.getIdToken());
      await load();
      showToast("Product deactivated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The product could not be deactivated.", "error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>CATALOG &amp; PRICING</p>
          <h1>Rental Inventory</h1>
          <span>Manage product details, daily pricing, images, and physical unit counts.</span>
        </div>
        <button type="button" onClick={() => openEditor()}>Add Product</button>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      {!products && !error ? (
        <div className={styles.loading}><Spinner size={28} label="Loading catalog" /></div>
      ) : products ? (
        <div className={styles.grid}>
          {products.map((product) => (
            <article key={product.id} className={styles.card}>
              <div className={styles.imageWrap}>
                <Image src={product.image} alt="" fill sizes="240px" className={styles.image} />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <span>{product.category}</span>
                  <i className={product.isActive ? styles.active : styles.inactive}>
                    {product.isActive ? "Active" : "Inactive"}
                  </i>
                </div>
                <h2>{product.name}</h2>
                <p>{product.brand}</p>
                <strong>PHP {product.pricePerDay.toLocaleString("en-PH")} / day</strong>
                <small>{product.totalUnits ?? 0} physical unit(s)</small>
                <div className={styles.actions}>
                  <button type="button" onClick={() => openEditor(product)}>Edit</button>
                  {product.isActive ? (
                    <button type="button" className={styles.danger} onClick={() => deactivate(product)}>
                      Deactivate
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {products ? (
        <section className={styles.history}>
          <div><p>PRICE CHANGE HISTORY</p><h2>Recent Pricing Updates</h2></div>
          <div className={styles.historyTable}>
            <table>
              <thead><tr><th>Product</th><th>Previous</th><th>New price</th><th>Reason</th><th>Date</th></tr></thead>
              <tbody>
                {[...priceHistory]
                  .sort(
                    (a, b) =>
                      Date.parse(b.createdAt || "") -
                      Date.parse(a.createdAt || ""),
                  )
                  .slice(0,20)
                  .map((entry)=><tr key={`${entry.productId}-${entry.id}`}>
                    <td>{products.find((product)=>product.id===entry.productId)?.name ?? entry.productId}</td>
                    <td>{entry.previousPrice === null ? "Initial" : `PHP ${entry.previousPrice.toLocaleString("en-PH")}`}</td>
                    <td>PHP {entry.newPrice.toLocaleString("en-PH")}</td>
                    <td>{entry.reason}</td>
                    <td>
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString("en-PH")
                        : "—"}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {editing ? (
        <div className={styles.overlay} role="presentation" onMouseDown={() => !saving && setEditing(null)}>
          <section className={styles.editor} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.editorHeader}>
              <div><p>PRODUCT EDITOR</p><h2>{editing === "new" ? "Add Product" : "Edit Product"}</h2></div>
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <label><span>Product name</span><input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} /></label>
              <label><span>Brand</span><input value={form.brand} onChange={(e) => setForm({...form, brand:e.target.value})} /></label>
              <label><span>Category</span><select value={form.category} onChange={(e) => setForm({...form, category:e.target.value as "Phones" | "Cameras"})}><option>Phones</option><option>Cameras</option></select></label>
              <label><span>Daily price (PHP)</span><input type="number" min="1" value={form.pricePerDay} onChange={(e) => setForm({...form, pricePerDay:Number(e.target.value)})} /></label>
              <label><span>Physical units</span><input type="number" min="0" value={form.totalUnits} onChange={(e) => setForm({...form, totalUnits:Number(e.target.value)})} /></label>
              <label><span>Catalog image</span><input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} /></label>
              <label className={styles.wide}><span>Description</span><textarea rows={4} value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} /></label>
              <label className={styles.wide}><span>Included accessories (one per line)</span><textarea rows={4} value={includedText} onChange={(e) => setIncludedText(e.target.value)} /></label>
              <label className={styles.checkbox}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive:e.target.checked})} /><span>Visible in public catalog</span></label>
            </div>
            <div className={styles.editorActions}>
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
