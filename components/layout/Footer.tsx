import Link from "next/link";
import { PhoneCall, MapPin, Mail } from "lucide-react";
import { IconBrandWhatsapp, IconBrandFacebook, IconBrandTiktok, IconStarFilled, IconStarHalfFilled } from "@tabler/icons-react";

export default function Footer() {
  return (
    <footer className="relative mt-auto w-full bg-white/40 backdrop-blur-xl border-t border-gray-200/50">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-12 lg:px-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">

        {/* Brand Section */}
        <div className="flex flex-col gap-4">
          <Link href="/">
            <div className="flex items-center gap-3 group cursor-pointer w-fit">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0c0b5d] text-white shadow-lg shadow-[#0c0b5d]/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[#0c0b5d]/40 group-active:scale-95">
                <img
                  src="/logo.jpg"
                  alt="Unique Futsal Logo"
                  className="h-full w-full object-cover rounded"
                />
              </div>
              <span className="text-xl font-black uppercase tracking-tight text-[#0c0b5d] group-hover:text-[#FA6400] transition-colors">Unique Futsal</span>
            </div>
          </Link>
          <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm mt-2">
            Experience the thrill of futsal at the best indoor arena. Premium pitches, instant bookings, and an unforgettable vibe.
          </p>

          {/* Google Rating Badge */}
          <Link
            href="https://share.google/mfV1NI8KSH99SUgug"
            target="_blank"
            className="mt-4 flex flex-col gap-2 w-fit group"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <IconStarFilled key={i} size={14} className="text-yellow-400" />
                ))}
                <IconStarHalfFilled size={14} className="text-yellow-400" />
              </div>
              <span className="text-sm font-black text-[#0c0b5d] group-hover:text-[#FA6400] transition-colors">4.3 / 5</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-600 transition-colors">
              58 Customer Reviews
            </span>
          </Link>
        </div>

        {/* Contact Info */}
        <div className="flex flex-col gap-6">
          <h3 className="text-sm font-black uppercase text-[#0c0b5d] tracking-widest">Contact Us</h3>
          <ul className="flex flex-col gap-4">
            <li>
              <Link href="tel:+9811940018" className="group flex items-center gap-3 w-fit text-sm font-bold text-slate-500 hover:text-[#FA6400] transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 group-hover:border-orange-200 group-hover:bg-orange-50 transition-all">
                  <PhoneCall size={18} />
                </div>
                9811940018
              </Link>
            </li>
            <li>
              <Link href="mailto:info.uniquefutsal@gmail.com" className="group flex items-center gap-3 w-fit text-sm font-bold text-slate-500 hover:text-[#FA6400] transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 group-hover:border-orange-200 group-hover:bg-orange-50 transition-all">
                  <Mail size={18} />
                </div>
                info.uniquefutsal@gmail.com
              </Link>
            </li>
            <li className="flex items-start gap-3 w-fit text-sm font-bold text-slate-500">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100">
                <MapPin size={18} />
              </div>
              <span className="mt-2 text-slate-500">Manigram Tilottama-05 Rupandehi, Nepal</span>
            </li>
          </ul>
        </div>

        {/* Social Links */}
        <div className="flex flex-col gap-6">
          <h3 className="text-sm font-black uppercase text-[#0c0b5d] tracking-widest">Follow Us</h3>
          <p className="text-sm font-medium text-slate-500 mb-2">
            Stay updated with our latest offers, tournaments, and events.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://wa.me/9811940018"
              target="_blank"
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 text-green-600 hover:text-white hover:bg-green-600 hover:border-green-600 hover:scale-110 hover:-translate-y-1 transition-all duration-300"
            >
              <IconBrandWhatsapp size={24} stroke={2} className="group-hover:scale-110 transition-transform" />
            </Link>
            <Link
              href="https://www.facebook.com/uniquefutsalManigramButwal"
              target="_blank"
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 text-blue-600 hover:text-white hover:bg-blue-600 hover:border-blue-600 hover:scale-110 hover:-translate-y-1 transition-all duration-300"
            >
              <IconBrandFacebook size={24} stroke={2} className="group-hover:scale-110 transition-transform" />
            </Link>
            <Link
              href="https://www.tiktok.com/@unique.futsal"
              target="_blank"
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-200 text-black hover:text-white hover:bg-black hover:border-black hover:scale-110 hover:-translate-y-1 transition-all duration-300"
            >
              <IconBrandTiktok size={24} stroke={2} className="group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Map Section */}
        <div className="flex flex-col gap-6 md:col-span-1">
          <h3 className="text-sm font-black uppercase text-[#0c0b5d] tracking-widest">Find Us</h3>
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md h-40 w-full relative group">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3535.1407884101736!2d83.46994617517807!3d27.6201559762327!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3996857d5a766749%3A0x24b3baaae56d7919!2sUnique%20Futsal!5e0!3m2!1sen!2snp!4v1775201295258!5m2!1sen!2snp"
              className="absolute inset-0 w-full h-full border-0 transition-all duration-500"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>

      </div>

      {/* Copyright */}
      <div className="w-full border-t border-gray-200/60 bg-white/50">
        <div className="mx-auto max-w-7xl px-6 py-6 md:px-12 lg:px-20 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-400 text-center md:text-left">
            © {new Date().getFullYear()} Unique Futsal. All rights reserved.
          </p>
          {/* <p className="text-sm font-semibold text-slate-400 text-center md:text-right">
            Developed by{" "}
            <Link
              href="https://www.inovexmediatech.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0c0b5d] hover:text-[#FA6400] transition-colors underline underline-offset-4 decoration-slate-300 hover:decoration-[#FA6400]"
            >
              Inovex Media and Tech
            </Link>
          </p> */}
        </div>
      </div>

      {/* Bottom brand gradient line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{
          background: "linear-gradient(90deg, #0c0b5d 0%, #FA6400 50%, #0c0b5d 100%)",
        }}
      />
    </footer>
  );
}
