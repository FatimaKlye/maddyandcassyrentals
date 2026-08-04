"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/src/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import Spinner from "@/components/ui/Spinner";
import {
  createCatalogProductAsAdmin,
  deactivateCatalogProductAsAdmin,
  updateCatalogProductAsAdmin,
  uploadCatalogImage,
  type CatalogEditorInput,
} from "@/src/services/productService";
import { getAdminCatalog, type AdminPriceHistoryEntry } from "@/src/services/operationsService";
import type { Product } from "@/types/product";
import styles from "./catalog.module.css";

const blankForm: CatalogEditorInput = {
  name: "",
  brand: "",
  category: "Phones",
  shortDescription: "",
  description: "",
  dailyRate: 0,
  refundableDeposit: 0,
  specifications: {},
  totalUnits: 1,
  isFeatured: false,
  status: "active",
};

export default function AdminCatalogManager() {
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
    setError(null);
    try {
      const data = await getAdminCatalog();
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openEditor(product?: Product) {
    if (product) {
      setEditing(product);
      setForm({
        name: product.name,
        brand: product.brand ?? "",
        category: product.category,
        shortDescription: product.shortDescription ?? "",
        description: product.description ?? "",
        dailyRate: product.dailyRate,
        refundableDeposit: product.refundableDeposit,
        specifications: product.specifications,
        totalUnits: product.totalUnits ?? 0,
        isFeatured: product.isFeatured,
        status: product.status,
      });
      setIncludedText(product.included.join("\n"));
    } else {
      setEditing("new");
      setForm(blankForm);
      setIncludedText("");
    }
    setImageFile(null);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const editorInput: CatalogEditorInput = {
        ...form,
        specifications: {
          ...form.specifications,
          included: includedText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
            .join(", "),
        },
      };
      if (editing === "new") {
        await createCatalogProductAsAdmin(editorInput);
        await load();
      } else {
        await updateCatalogProductAsAdmin(editing.id, editorInput);
        if (imageFile) {
          await uploadCatalogImage(supabase, editing.id, imageFile);
        }
        await load();
      }
      setEditing(null);
      showToast("Catalog and inventory updated.", "success");
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "The product could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(product: Product) {
    if (!window.confirm(`Deactivate ${product.name}? Existing booking records will remain.`)) {
      return;
    }
    try {
      await deactivateCatalogProductAsAdmin(product.id);
      await load();
      showToast("Product deactivated.", "success");
    } catch (deactivateError) {
      showToast(
        deactivateError instanceof Error ? deactivateError.message : "The product could not be deactivated.",
        "error",
      );
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
                <Image src={product.image || "/images/maddy-cassy-rentals-icon.png"} alt="" fill sizes="240px" className={styles.image} />
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
              <label><span>Category</span><select value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}><option>Phones</option><option>Cameras</option></select></label>
              <label><span>Daily price (PHP)</span><input type="number" min="1" value={form.dailyRate} onChange={(e) => setForm({...form, dailyRate:Number(e.target.value)})} /></label>
              <label><span>Refundable deposit (PHP)</span><input type="number" min="0" value={form.refundableDeposit} onChange={(e) => setForm({...form, refundableDeposit:Number(e.target.value)})} /></label>
              <label><span>Physical units</span><input type="number" min="0" value={form.totalUnits} onChange={(e) => setForm({...form, totalUnits:Number(e.target.value)})} /></label>
              <label><span>Catalog image</span><input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={editing === "new"} /></label>
              <label className={styles.wide}><span>Short description</span><input value={form.shortDescription ?? ""} onChange={(e) => setForm({...form, shortDescription:e.target.value})} /></label>
              <label className={styles.wide}><span>Description</span><textarea rows={4} value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} /></label>
              <label className={styles.wide}><span>Included accessories (one per line)</span><textarea rows={4} value={includedText} onChange={(e) => setIncludedText(e.target.value)} /></label>
              <label className={styles.checkbox}><input type="checkbox" checked={form.status === "active"} onChange={(e) => setForm({...form, status: e.target.checked ? "active" : "inactive"})} /><span>Visible in public catalog</span></label>
            </div>
            {editing === "new" ? (
              <p className={styles.wide}>Upload the catalog image after creating the product.</p>
            ) : null}
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
