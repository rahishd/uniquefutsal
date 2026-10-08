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
    <footer className="mx-auto w-full max-w-md px-5 pb-40 pt-12 desk:max-w-none desk:px-10 desk:pb-14 desk:pt-6">
      <section aria-label="Message from the founder" className="glass mb-10 space-y-3 rounded-3xl p-5 desk:p-8">
        <h2 className={heading}>Message from the founder</h2>
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            My valued customers are at the heart of this journey. I want to build genuine relationships by listening to their needs, welcoming their ideas, and creating experiences they’re proud to be part of. Their trust and support help Unique Futsal grow, while every game gives us another chance to connect and make the community stronger.
          </p>
          <p>
            Unique Futsal brings people together through shared games and inclusive experiences, turning a common interest into friendships, encouragement, and a stronger sense of belonging. I also see technology as a way to make sports more accessible and organized, helping people discover sessions, coordinate participation, and stay connected beyond the game.
          </p>
          <p>
            For me, success is found in new friendships, shared progress, and opportunities to grow together. Unique Futsal is my effort to unite sport, technology, and community in one meaningful experience—one game, one connection, and one opportunity at a time.
          </p>
        </div>
        <p className="pt-1 text-sm">
          <span className="block font-bold text-[#0c0b5d]">Rahish Dumre</span>
          <span className="block text-slate-500">Unique Futsal</span>
        </p>
      </section>

      <div className="space-y-10 desk:grid desk:grid-cols-3 desk:gap-10 desk:space-y-0">
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
