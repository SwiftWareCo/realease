import { redirect } from "next/navigation";

export default function ActivePage() {
    // Redirect to buyer page by default
    redirect("/leads/active/buyer");
}
