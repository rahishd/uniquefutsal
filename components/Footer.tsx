import { Mail, MapPin, PhoneCall } from "lucide-react";
import { FaFacebookF, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { site } from "@/lib/site";


function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const cls = "glass flex h-12 w-12 items-center justify-center rounded-2xl text-lg";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
      {children}
    </a>
  ) : (
    <span aria-label={`${label} (link coming soon)`} className={`${cls} opacity-70`}>
      {children}
    </span>
  );
}

const heading = "text-xs font-bold uppercase tracking-[0.2em] text-[#0c0b5d]";

export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-md px-5 pb-40 pt-12">
      <div className="space-y-10">
        <div>
          <h2 className={heading}>Contact us</h2>
          <ul className="mt-4 space-y-3 text-sm font-medium text-slate-600">
            <li>
              <a href={`tel:${site.phone}`} className="flex items-center gap-3">
                <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                  <PhoneCall size={18} />
                </span>
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="flex items-center gap-3">
                <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                  <Mail size={18} />
                </span>
                <span className="break-all">{site.email}</span>
              </a>
            </li>
            <li className="flex items-center gap-3">
              <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500">
                <MapPin size={18} />
              </span>
              {site.address}
            </li>
          </ul>
        </div>

        <div>
          <h2 className={heading}>Follow us</h2>
          <p className="mt-4 text-sm text-slate-500">Stay updated with our latest offers, tournaments, and events.</p>
          <div className="mt-4 flex gap-3">
            <Social href={site.whatsapp} label="WhatsApp">
              <FaWhatsapp className="text-[#25d366]" />
            </Social>
            <Social href={site.facebook} label="Facebook">
              <FaFacebookF className="text-[#1877f2]" />
            </Social>
            <Social href={site.tiktok} label="TikTok">
              <FaTiktok className="text-black" />
            </Social>
          </div>
        </div>

        <div>
          <h2 className={heading}>Find us</h2>
          <div className="glass mt-4 overflow-hidden rounded-2xl">
            <iframe
              title={`${site.name} on Google Maps`}
              src={site.mapEmbed}
              className="h-48 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
