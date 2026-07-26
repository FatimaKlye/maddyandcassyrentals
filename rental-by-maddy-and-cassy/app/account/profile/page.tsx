import type { Metadata } from "next";
import CustomerProfileForm from "./CustomerProfileForm";

export const metadata: Metadata = {
  title: "My Profile | Rental by Maddy & Cassy",
  description: "View and update your Rental by Maddy & Cassy customer profile.",
};

export default function CustomerProfilePage() {
  return <CustomerProfileForm />;
}
