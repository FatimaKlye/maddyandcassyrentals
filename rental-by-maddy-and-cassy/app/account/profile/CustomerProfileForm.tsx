"use client";

import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile } from "@/src/services/userService";
import type { UserProfile } from "@/src/types/firebase";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/Form.module.css";
import Spinner from "@/components/ui/Spinner";
import styles from "./profile.module.css";

interface ProfileDraft {
  displayName: string;
  phoneNumber: string;
  fullAddress: string;
  facebookLink: string;
  instagramLink: string;
}

function draftFromProfile(profile: UserProfile): ProfileDraft {
  return {
    displayName: profile.displayName ?? "",
    phoneNumber: profile.phoneNumber ?? "",
    fullAddress: profile.fullAddress ?? "",
    facebookLink: profile.facebookLink ?? "",
    instagramLink: profile.instagramLink ?? "",
  };
}

export default function CustomerProfileForm() {
  const { user, profile, refreshProfile } = useAuth();

  if (!profile || !user) {
    return (
      <div className={styles.loading}>
        <Spinner size={26} label="Loading your profile" />
      </div>
    );
  }

  return (
    <CustomerProfileEditor
      key={profile.updatedAt?.toMillis?.() ?? profile.id}
      user={user}
      profile={profile}
      refreshProfile={refreshProfile}
    />
  );
}

interface CustomerProfileEditorProps {
  user: User;
  profile: UserProfile;
  refreshProfile: () => Promise<void>;
}

function CustomerProfileEditor({
  user,
  profile,
  refreshProfile,
}: CustomerProfileEditorProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [saving, setSaving] = useState(false);

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    if (draft.displayName.trim().length < 2) {
      showToast("Please enter your full name.", "error");
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: draft.displayName.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        fullAddress: draft.fullAddress.trim(),
        facebookLink: draft.facebookLink.trim(),
        instagramLink: draft.instagramLink.trim(),
      });
      await refreshProfile();
      showToast("Your profile has been updated.", "success");
    } catch {
      showToast("We couldn't update your profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="profile-heading">
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden="true">
          {profile.displayName?.charAt(0).toUpperCase() || "C"}
        </div>
        <div>
          <p className={styles.eyebrow}>CUSTOMER ACCOUNT</p>
          <h1 id="profile-heading" className={styles.heading}>
            My Profile
          </h1>
          <p className={styles.subheading}>
            Keep your contact information current for booking coordination.
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="profile-name">
              Full name<span className={formStyles.required}>*</span>
            </label>
            <input
              id="profile-name"
              className={formStyles.input}
              value={draft.displayName}
              onChange={(event) => updateDraft("displayName", event.target.value)}
              autoComplete="name"
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="profile-email">
              Email address
            </label>
            <input
              id="profile-email"
              className={formStyles.input}
              value={profile.email || user?.email || ""}
              disabled
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="profile-phone">
            Phone number
          </label>
          <input
            id="profile-phone"
            className={formStyles.input}
            value={draft.phoneNumber}
            onChange={(event) => updateDraft("phoneNumber", event.target.value)}
            autoComplete="tel"
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="profile-address">
            Full address
          </label>
          <textarea
            id="profile-address"
            className={formStyles.textarea}
            value={draft.fullAddress}
            onChange={(event) => updateDraft("fullAddress", event.target.value)}
            autoComplete="street-address"
          />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="profile-facebook">
              Facebook profile link
            </label>
            <input
              id="profile-facebook"
              type="url"
              className={formStyles.input}
              value={draft.facebookLink}
              onChange={(event) => updateDraft("facebookLink", event.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="profile-instagram">
              Instagram profile link
            </label>
            <input
              id="profile-instagram"
              type="url"
              className={formStyles.input}
              value={draft.instagramLink}
              onChange={(event) => updateDraft("instagramLink", event.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
        </div>

        <div className={styles.footer}>
          <span className={`${styles.status} ${styles[profile.accountStatus]}`}>
            Account {profile.accountStatus}
          </span>
          <button type="submit" className={formStyles.primaryButton} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </section>
  );
}
