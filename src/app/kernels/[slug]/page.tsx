import { KERNELS } from "@/data/kernels";
import KernelPageClient from "./KernelPageClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return KERNELS.map((k) => ({ slug: k.slug }));
}

export default async function KernelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <KernelPageClient slug={slug} />;
}
