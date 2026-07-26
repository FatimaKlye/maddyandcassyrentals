"use client";

import { useState } from "react";
import type { RequirementsDraft } from "@/src/types/reservationDraft";
import FileUploadField from "@/components/file-upload/FileUploadField";
import formStyles from "@/components/ui/Form.module.css";
import styles from "./StepShared.module.css";

interface StepRequirementsProps {
  requirements: RequirementsDraft;
  onUpdate: (patch: Partial<RequirementsDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
}

const ACCEPTED_ID_EXAMPLES = "Passport, National ID, Driver's License, or School ID";

export default function StepRequirements({
  requirements,
  onUpdate,
  onBack,
  onContinue,
}: StepRequirementsProps) {
  const [errors, setErrors] = useState<string[]>([]);

  function updateEmergencyContact(patch: Partial<RequirementsDraft["emergencyContact"]>) {
    onUpdate({ emergencyContact: { ...requirements.emergencyContact, ...patch } });
  }

  function validate(): boolean {
    const nextErrors: string[] = [];
    if (!requirements.idOneFile) nextErrors.push("Please upload your first valid ID.");
    if (!requirements.idTwoFile) nextErrors.push("Please upload your second valid ID.");
    if (!requirements.selfieFile) nextErrors.push("Please upload a selfie holding a valid ID.");
    if (!requirements.facebookLink.trim()) nextErrors.push("Your active Facebook profile link is required.");
    if (!requirements.instagramLink.trim()) nextErrors.push("Your active Instagram profile link is required.");
    if (!requirements.emergencyContact.fullName.trim()) nextErrors.push("Emergency contact full name is required.");
    if (!requirements.emergencyContact.relationship.trim()) nextErrors.push("Emergency contact relationship is required.");
    if (!requirements.emergencyContact.phone.trim()) nextErrors.push("Emergency contact phone number is required.");
    if (!requirements.emergencyContact.facebookLink.trim()) nextErrors.push("Emergency contact Facebook link is required.");
    if (!requirements.emergencyContact.idFile) nextErrors.push("Emergency contact's government-issued ID is required.");

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  function handleContinue() {
    if (validate()) onContinue();
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Rental Requirements</h2>
      <p className={styles.subheading}>
        Accepted valid IDs: {ACCEPTED_ID_EXAMPLES}. At least one ID must show your current
        address and signature.
      </p>

      <div className={formStyles.row}>
        <FileUploadField
          label="First valid ID"
          required
          value={requirements.idOneFile}
          onChange={(file) => onUpdate({ idOneFile: file })}
        />
        <FileUploadField
          label="Second valid ID"
          required
          helpText="At least one of your two IDs must show your current address and signature."
          value={requirements.idTwoFile}
          onChange={(file) => onUpdate({ idTwoFile: file })}
        />
      </div>

      <FileUploadField
        label="Selfie holding a valid ID"
        required
        value={requirements.selfieFile}
        onChange={(file) => onUpdate({ selfieFile: file })}
      />

      <div className={formStyles.row}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="req-facebook">
            Active Facebook profile link<span className={formStyles.required}>*</span>
          </label>
          <input
            id="req-facebook"
            type="url"
            className={formStyles.input}
            value={requirements.facebookLink}
            onChange={(event) => onUpdate({ facebookLink: event.target.value })}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="req-instagram">
            Active Instagram profile link<span className={formStyles.required}>*</span>
          </label>
          <input
            id="req-instagram"
            type="url"
            className={formStyles.input}
            value={requirements.instagramLink}
            onChange={(event) => onUpdate({ instagramLink: event.target.value })}
          />
        </div>
      </div>

      <h3 className={styles.sectionHeading}>Emergency Contact</h3>

      <div className={formStyles.row}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="ec-name">
            Full name<span className={formStyles.required}>*</span>
          </label>
          <input
            id="ec-name"
            className={formStyles.input}
            value={requirements.emergencyContact.fullName}
            onChange={(event) => updateEmergencyContact({ fullName: event.target.value })}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="ec-relationship">
            Relationship to you<span className={formStyles.required}>*</span>
          </label>
          <input
            id="ec-relationship"
            className={formStyles.input}
            value={requirements.emergencyContact.relationship}
            onChange={(event) => updateEmergencyContact({ relationship: event.target.value })}
          />
        </div>
      </div>

      <div className={formStyles.row}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="ec-phone">
            Active phone number<span className={formStyles.required}>*</span>
          </label>
          <input
            id="ec-phone"
            type="tel"
            className={formStyles.input}
            value={requirements.emergencyContact.phone}
            onChange={(event) => updateEmergencyContact({ phone: event.target.value })}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="ec-facebook">
            Facebook profile link<span className={formStyles.required}>*</span>
          </label>
          <input
            id="ec-facebook"
            type="url"
            className={formStyles.input}
            value={requirements.emergencyContact.facebookLink}
            onChange={(event) => updateEmergencyContact({ facebookLink: event.target.value })}
          />
        </div>
      </div>

      <FileUploadField
        label="Emergency contact's government-issued ID"
        required
        value={requirements.emergencyContact.idFile}
        onChange={(file) => updateEmergencyContact({ idFile: file })}
      />

      {errors.length > 0 ? (
        <ul className={formStyles.errorText} role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.footer}>
        <button type="button" className={formStyles.secondaryButton} onClick={onBack}>
          Back
        </button>
        <button type="button" className={formStyles.primaryButton} onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
