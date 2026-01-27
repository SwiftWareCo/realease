import { redirect } from "next/navigation";

export default function LeadsPage() {
    // Redirect to network page by default
    redirect("/leads/network");
}
