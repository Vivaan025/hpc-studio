import Link from "next/link";
import { SITE } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="border-t border-[#dccfb2] py-8 mt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-[#967f5e]">
            <Link href="/" className="hover:text-[#5e4a30] transition-colors">
              {SITE.name}
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link href="/kernels" className="hover:text-[#5e4a30] transition-colors">
              Kernels
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link href="/blog" className="hover:text-[#5e4a30] transition-colors">
              Blog
            </Link>
          </div>
          <div className="text-xs text-[#bfad88]">
            Interactive GPU kernel visualizations
          </div>
        </div>
      </div>
    </footer>
  );
}
