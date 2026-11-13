import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import { loadPortalData } from "@/lib/foodbank/portal";
import PortalApp from "./PortalApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Diet Plan — NutriPlan" };

export default async function PortalPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/portal/login");
  const data = await loadPortalData(client.id);
  if (!data) redirect("/portal/login");
  return <PortalApp initial={data} />;
}
