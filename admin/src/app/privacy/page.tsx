import React from 'react';
import type { Metadata } from 'next';
import { 
  ShieldCheck, 
  MapPin, 
  Bell, 
  CreditCard, 
  Database, 
  Trash2, 
  Mail, 
  Lock, 
  Info,
  Smartphone
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | AFoodoo',
  description: 'Privacy Policy for AFoodoo mobile application and delivery services managed by Apdevlab.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Navigation / Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🍲</span>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                AFoodoo
              </span>
              <span className="block text-[11px] text-slate-400 font-medium">Daily Meals & Delivery</span>
            </div>
          </div>
          <a
            href="mailto:admin.afoodoo@gmail.com"
            className="text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-orange-400 font-medium mb-4">
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            <span>Official Privacy Documentation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Last Updated: <span className="text-slate-300 font-medium">September 26, 2026</span> • Effective Immediately
          </p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-300">
          {/* Section: Overview */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <Info className="w-5 h-5 text-orange-400" />
              Introduction
            </h2>
            <p className="mb-3">
              This Privacy Policy explains how <strong>AFoodoo</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), operated by <strong>Apdevlab</strong>, collects, uses, shares, and protects your information when you use our mobile application (the &quot;App&quot;) and related food delivery services.
            </p>
            <p>
              By accessing or using the AFoodoo app, you consent to the practices described in this Privacy Policy. If you do not agree with any part of this policy, please do not use our application or services.
            </p>
          </section>

          {/* Section 1: Information We Collect */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2.5">
              <Database className="w-5 h-5 text-orange-400" />
              1. Information We Collect
            </h2>
            <p className="mb-4">
              We collect information that you directly provide to us, as well as information automatically collected when using the App:
            </p>
            <ul className="space-y-3 pl-2">
              <li className="flex items-start gap-2.5">
                <span className="text-orange-400 font-bold">•</span>
                <div>
                  <strong className="text-white">Account & Contact Details:</strong> When you register or log in, we collect your phone number (verified via SMS OTP), full name, and optional profile details.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-orange-400 font-bold">•</span>
                <div>
                  <strong className="text-white">Delivery Addresses & Instructions:</strong> Room, apartment, street address, landmark, and delivery preferences provided to ensure accurate meal delivery.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-orange-400 font-bold">•</span>
                <div>
                  <strong className="text-white">Order & Subscription History:</strong> Details of tiffin meals, meal portions, scheduled delivery times, coupons applied, and transaction history.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-orange-400 font-bold">•</span>
                <div>
                  <strong className="text-white">Device Information:</strong> Device model, operating system version, and unique push notification identifiers needed to dispatch updates to your device.
                </div>
              </li>
            </ul>
          </section>

          {/* Section 2: Location Data Policy (CRITICAL FOR PLAY STORE) */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-orange-400" />
              2. Location Data Collection & Usage
            </h2>
            <div className="bg-orange-950/20 border border-orange-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs sm:text-sm text-orange-300 font-medium">
                AFoodoo requests location permissions (<code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-orange-200">ACCESS_FINE_LOCATION</code> and <code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-orange-200">ACCESS_COARSE_LOCATION</code>) solely when the app is in foreground use.
              </p>
            </div>
            <p className="mb-3">
              We collect your device geolocation <strong>only when you explicitly request it</strong> (such as tapping &quot;Use Current Location&quot; on the checkout screen) for the following specific purposes:
            </p>
            <ol className="list-decimal pl-5 space-y-2 mb-3">
              <li>To auto-fill your delivery coordinates accurately so our delivery partners can find your dropoff location without delay.</li>
              <li>To compute distance-based delivery charges from our central kitchen to your doorstep.</li>
              <li>To confirm your address falls within our active operational service radius.</li>
            </ol>
            <p className="text-xs text-slate-400">
              * Note: AFoodoo does <strong>not</strong> track your background location when the app is closed, and we do not sell or share your location data with third-party advertising networks.
            </p>
          </section>

          {/* Section 3: Push Notifications */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-orange-400" />
              3. Push Notifications
            </h2>
            <p className="mb-3">
              With your permission (<code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-slate-200">POST_NOTIFICATIONS</code>), we send transactional notifications regarding:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mb-3 text-slate-300">
              <li>Order confirmation and kitchen preparation status.</li>
              <li>Delivery dispatch and out-for-delivery alerts.</li>
              <li>Subscription renewal and meal plan reminders.</li>
            </ul>
            <p className="text-xs text-slate-400">
              You can modify or disable notification preferences at any time in your device system settings.
            </p>
          </section>

          {/* Section 4: Payments and Commercial Transactions */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-orange-400" />
              4. Payments & Financial Transactions
            </h2>
            <p className="mb-3">
              AFoodoo delivers physical goods (cooked meals and tiffin subscriptions). In accordance with Google Play Developer Policies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>All payments are for physical goods and services delivered offline.</li>
              <li>Payments are handled through Cash on Delivery (COD) or verified direct payment methods.</li>
              <li>The app does not collect, process, or store sensitive credit/debit card numbers or CVVs on our servers.</li>
              <li>The app does not sell digital goods, in-app currency, or digital content requiring Google Play In-App Billing.</li>
            </ul>
          </section>

          {/* Section 5: Third-Party Service Providers */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-orange-400" />
              5. Third-Party Service Providers
            </h2>
            <p className="mb-3">
              We partner with industry-standard, secure infrastructure providers to deliver our services:
            </p>
            <ul className="space-y-2.5 pl-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-400">•</span>
                <div>
                  <strong className="text-white">Google Firebase (Google Cloud):</strong> Provides secure user authentication, real-time database management, and cloud infrastructure. Firebase adheres strictly to ISO/IEC and GDPR security certifications.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400">•</span>
                <div>
                  <strong className="text-white">Expo Push Services:</strong> Used securely to deliver real-time order status notifications to your Android device.
                </div>
              </li>
            </ul>
          </section>

          {/* Section 6: Data Retention & Account Deletion (Google Play Mandatory) */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <Trash2 className="w-5 h-5 text-red-400" />
              6. Data Retention & Account Deletion Policy
            </h2>
            <p className="mb-3">
              We retain your information only as long as necessary to provide services to you or comply with regulatory financial recordkeeping requirements.
            </p>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 mb-3">
              <p className="font-semibold text-white mb-1.5">How to Request Account & Data Deletion:</p>
              <p className="text-xs sm:text-sm text-slate-300 mb-2">
                You have the full right to delete your account and all associated personal data at any time. To request deletion:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm text-slate-300">
                <li>Send an email from your registered email or phone to: <a href="mailto:admin.afoodoo@gmail.com" className="text-orange-400 underline font-medium">admin.afoodoo@gmail.com</a></li>
                <li>Use the subject line: <code className="bg-slate-900 px-1 py-0.5 rounded text-orange-300">AFoodoo - Account Deletion Request</code></li>
                <li>Provide your registered mobile number.</li>
              </ol>
              <p className="text-xs text-slate-400 mt-2">
                Upon verification, your profile, addresses, and order records will be permanently deleted from our primary databases within 7 business days.
              </p>
            </div>
          </section>

          {/* Section 7: Children's Privacy */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-orange-400" />
              7. Children&apos;s Privacy
            </h2>
            <p>
              Our services are not directed to individuals under the age of 13. We do not knowingly collect personal identifiable information from children under 13. If we discover that a child under 13 has provided us with personal information, we immediately remove it from our systems.
            </p>
          </section>

          {/* Section 8: Changes to Privacy Policy */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-3">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated &quot;Last Updated&quot; date. We encourage you to review this page periodically for any updates.
            </p>
          </section>

          {/* Section 9: Contact Us */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/20 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-orange-400" />
              9. Contact Information
            </h2>
            <p className="text-slate-300 mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact our team:
            </p>
            <div className="space-y-1.5 text-xs sm:text-sm">
              <p><strong className="text-white">Developer / Entity:</strong> Apdevlab</p>
              <p><strong className="text-white">Application:</strong> AFoodoo - Daily Meals & Delivery</p>
              <p>
                <strong className="text-white">Support Email:</strong>{' '}
                <a href="mailto:admin.afoodoo@gmail.com" className="text-orange-400 hover:underline font-medium">
                  admin.afoodoo@gmail.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-16 py-8 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4">
          <p>© {new Date().getFullYear()} AFoodoo (Apdevlab). All rights reserved.</p>
          <p className="mt-1">Dedicated to providing clean, fresh, and timely daily meals.</p>
        </div>
      </footer>
    </div>
  );
}
