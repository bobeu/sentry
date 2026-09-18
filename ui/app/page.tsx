"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ChatMessage = {
  sender: string;
  text: string;
  type: "user" | "sentry";
  badge?: string;
};

const SIMULATED_CONVERSATIONS: Record<string, { trigger: string; messages: ChatMessage[] }> = {
  faq: {
    trigger: "Resolve community FAQ",
    messages: [
      { sender: "Alice", text: "Hey! What currency does Sentry accept and how do I deposit funds?", type: "user" },
      { sender: "Sentry", text: "Hello @Alice! Sentry operates using a manager-controlled prepaid wallet on Celo. It accepts USDm/CELO. You can fund the wallet by connecting MetaMask/MiniPay directly on the dashboard, or send tokens directly to the address and sync.", type: "sentry", badge: "FAQ ANSWER" }
    ]
  },
  spam: {
    trigger: "Moderate malicious spam link",
    messages: [
      { sender: "Web3Air_Bot", text: "🚨 GET FREE $500 AIRDROP IMMEDIATELY!! CLICK HERE 👉 http://celo-scam-rewards.xyz 🚨", type: "user" },
      { sender: "Sentry", text: "🛡️ Message deleted. Reason: High-confidence spam heuristic (unverified airdrop link). User @Web3Air_Bot warned.", type: "sentry", badge: "SPAM REMOVED" }
    ]
  },
  quiz: {
    trigger: "Host learn-and-earn quiz",
    messages: [
      { sender: "Manager_Bob", text: "@tgemployee_bot start quiz", type: "user" },
      { sender: "Sentry", text: "🎮 Trivia time — What chain is Sentry's prepaid wallet on?\n[A] Ethereum  [B] Celo  [C] Solana\nTap an answer · 10 pts. Check /mystatus anytime.", type: "sentry", badge: "QUIZ LIVE" }
    ]
  },
  handover: {
    trigger: "Trigger daily shift handover",
    messages: [
      { sender: "Manager_Bob", text: "@tgemployee_bot report status", type: "user" },
      { sender: "Sentry", text: "📊 Shift Handover (UTC 12:00 - 20:00):\n- Moderated: 14 spam attempts blocked.\n- Answered: 8 FAQ queries.\n- Quizzes: 3 rounds · 42 pts awarded.\n- Balance: 4.85 USDm remaining (Sufficient).", type: "sentry", badge: "SHIFT HANDOVER" }
    ]
  }
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"faq" | "spam" | "quiz" | "handover">("faq");
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 3500);
    return () => clearInterval(slideInterval);
  }, []);

  const [activeFeatureSlide, setActiveFeatureSlide] = useState(0);

  useEffect(() => {
    const featureInterval = setInterval(() => {
      setActiveFeatureSlide((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(featureInterval);
  }, []);


  useEffect(() => {
    setVisibleMessages([]);
    setIsTyping(false);

    const conv = SIMULATED_CONVERSATIONS[activeTab];
    let timeoutId: NodeJS.Timeout;

    timeoutId = setTimeout(() => {
      setVisibleMessages([conv.messages[0]]);
      
      timeoutId = setTimeout(() => {
        setIsTyping(true);

        timeoutId = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages([conv.messages[0], conv.messages[1]]);
        }, 1200);

      }, 800);

    }, 200);

    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  return (
    <main className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden bg-bg-light">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(0,82,255,0.06),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-noise" />

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 sm:pt-24 sm:pb-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6 space-y-6">
            <h1 className="font-sans text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text-dark leading-[1.05] animate-rise">
              Sentry <br />
              <span className="text-primary">
                Telegram ops for real communities
              </span>
            </h1>

            <p className="max-w-xl text-base sm:text-lg text-muted font-medium leading-relaxed animate-rise-delay-1">
              Sentry is a configurable Telegram agent for FAQ support, spam moderation, member engagement, and daily status reports. It is controlled by the employer, funded from a prepaid wallet, and designed to show what it did in plain language.
            </p>

            <div className="flex flex-wrap gap-4 pt-2 animate-rise-delay-2">
              <Link
                href="/login"
                className="rounded-full bg-accent px-8 py-3.5 text-sm font-bold text-slate-900 shadow-md hover:bg-accent/90 transition-all hover:scale-105"
              >
                Hire Sentry
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-primary/20 bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/5 transition-all"
              >
                See the workflow
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 pt-2 animate-rise-delay-2">
              <div className="rounded-2xl border border-primary/10 bg-white p-3 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">FAQ</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Answer in chat</div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-white p-3 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Moderation</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Catch spam fast</div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-white p-3 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Reports</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Daily summaries</div>
              </div>
            </div>
          </div>

          {/* Animated Hero Slideshow & Floating Message Bubbles */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center animate-rise-delay-2 h-[400px]">
            {/* Blurred background backing for image stack */}
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-lg -z-10" />

            <div className="absolute inset-x-4 top-4 z-20 flex justify-between gap-2 pointer-events-none">
              <div className="rounded-full bg-white/90 border border-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm">
                Employer controlled
              </div>
              <div className="rounded-full bg-accent/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-900 shadow-sm">
                Prepaid wallet
              </div>
            </div>

            {/* Floating Message Bubbles */}
            <div className="absolute inset-x-4 top-14 h-16 pointer-events-none z-20">
              <AnimatePresence>
                {(activeSlide === 0 || activeSlide === 3) && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.8 }}
                    className="absolute left-4 top-2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full px-3.5 py-1.5 shadow"
                  >
                    💬 FAQ answered in-group
                  </motion.div>
                )}
                {activeSlide === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.8 }}
                    className="absolute right-4 top-0 bg-[#00D283] text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-full px-3.5 py-1.5 shadow"
                  >
                    💰 Wallet funded +25 USDm
                  </motion.div>
                )}
                {activeSlide === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.8 }}
                    className="absolute left-1/2 -translate-x-1/2 top-1 bg-accent text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-full px-3.5 py-1.5 shadow"
                  >
                    ⚡ Spam blocked + handover sent
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Image Alternator Stack */}
            <div className="w-[90%] h-[75%] relative flex items-center justify-center mt-6">
              <AnimatePresence mode="wait">
                {activeSlide === 0 && (
                  <motion.div
                    key="slide0"
                    initial={{ y: 200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 200, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className="absolute inset-0 rounded-2xl border border-primary/10 overflow-hidden shadow-xl"
                  >
                    <Image
                      src="/hero-image-nologo.png"
                      alt="Sentry Visual"
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                )}

                {activeSlide === 1 && (
                  <motion.div
                    key="slide1"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className="absolute inset-0 rounded-2xl border border-primary/10 overflow-hidden shadow-xl"
                  >
                    <Image
                      src="/dashboard.png"
                      alt="Sentry Operations Dashboard"
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                )}

                {activeSlide === 2 && (
                  <motion.div
                    key="slide2"
                    initial={{ y: -100, scale: 0.8, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ y: -100, scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 90, damping: 12 }}
                    className="absolute inset-0 rounded-2xl border border-primary/10 overflow-hidden shadow-xl"
                  >
                    <Image
                      src="/many_roles.png"
                      alt="Sentry Roles"
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Slide Navigation Bullets */}
            <div className="flex gap-2.5 mt-4 z-10">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    activeSlide === idx ? "w-6 bg-primary" : "w-2.5 bg-primary/20 hover:bg-primary/45"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Telegram Sandbox Simulator */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
            Watch Sentry Work in Real-Time
          </h2>
          <p className="text-muted max-w-xl mx-auto font-medium">
            Click the tasks below to see Sentry intercept issues, host quizzes, resolve questions, or provide shift handover summaries inside mock Telegram threads.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Controls */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 justify-center">
            {Object.entries(SIMULATED_CONVERSATIONS).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as "faq" | "spam" | "quiz" | "handover")}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  activeTab === key
                    ? "bg-primary border-primary text-white shadow-md"
                    : "bg-white border-primary/10 text-text-dark hover:border-primary/20 hover:bg-primary/5"
                }`}
              >
                <div className={`text-[10px] uppercase font-bold mb-1 ${activeTab === key ? "text-accent" : "text-primary"}`}>
                  {key === "faq"
                    ? "FAQ Lookup"
                    : key === "spam"
                      ? "Trust & Safety"
                      : key === "quiz"
                        ? "Engagement"
                        : "Operations"}
                </div>
                <div className="font-extrabold text-sm">{data.trigger}</div>
              </button>
            ))}
          </div>

          {/* Simulated Chat Interface */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-primary/10 bg-white h-[380px] flex flex-col justify-between overflow-hidden shadow-md">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-primary/10 bg-primary px-5 py-4">
                <Image
                  src="/logo.png"
                  alt="Sentry Logo"
                  width={34}
                  height={34}
                  className="rounded-lg bg-white/20 p-0.5 border border-white/20"
                />
                <div>
                  <h3 className="font-bold text-white text-sm">Sentry Admin Bot</h3>
                  <p className="text-[10px] text-accent font-bold uppercase tracking-wider">online & monitoring</p>
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto flex flex-col justify-end bg-bg-light/60">
                <AnimatePresence mode="popLayout">
                  {visibleMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className={`flex flex-col max-w-[80%] ${
                        msg.type === "user" ? "self-start" : "self-end items-end"
                      }`}
                    >
                      <div className="text-[10px] text-muted mb-1 px-1 font-bold">
                        {msg.sender}
                      </div>
                      <div
                        className={`p-3.5 text-sm leading-relaxed font-medium ${
                          msg.type === "user"
                            ? "telegram-bubble-in text-text-dark"
                            : "telegram-bubble-out text-white"
                        }`}
                      >
                        {msg.text.split("\n").map((line, lIdx) => (
                          <div key={lIdx}>{line}</div>
                        ))}
                      </div>
                      {msg.badge && (
                        <span className="text-[8px] tracking-wider font-extrabold bg-accent text-slate-900 px-2 py-0.5 rounded mt-1.5 uppercase shadow-sm">
                          {msg.badge}
                        </span>
                      )}
                    </motion.div>
                  ))}

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="self-end flex items-center gap-1 bg-white border border-primary/10 px-4 py-2 rounded-full text-xs text-muted"
                    >
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce [animation-delay:0.2s]">●</span>
                      <span className="animate-bounce [animation-delay:0.4s]">●</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Alternator Spotlight */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
            A Clean Dashboard for Complex Tasks
          </h2>
          <p className="text-muted max-w-xl mx-auto font-medium">
            Sentry connects directly to your databases, policies, and Telegram chats, presenting everything in a high-fidelity workspace.
          </p>
        </div>

        {/* Feature Alternator Container */}
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Active Feature Slide Context Banner */}
          <div className="bg-white border border-primary/10 rounded-2xl p-5 shadow-sm min-h-[90px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {activeFeatureSlide === 0 && (
                <motion.div
                  key="feat0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">AI Operations Dashboard</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Track active sessions, response throughput, and verify overall performance indicators.
                  </p>
                </motion.div>
              )}
              {activeFeatureSlide === 1 && (
                <motion.div
                  key="feat1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">Pending Escalation Approvals</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Review drafted messages for high-stakes triggers prior to sending.
                  </p>
                </motion.div>
              )}
              {activeFeatureSlide === 2 && (
                <motion.div
                  key="feat2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">Shift Handover Logs</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Structured briefs delivered directly to the team summarizing events.
                  </p>
                </motion.div>
              )}
              {activeFeatureSlide === 3 && (
                <motion.div
                  key="feat3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">Adaptive Playbooks</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Teach policies in plain text. Rules are instantly contextualized by the AI.
                  </p>
                </motion.div>
              )}
              {activeFeatureSlide === 4 && (
                <motion.div
                  key="feat4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">Dedicated Persona Roles</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Customize tones, support roles, and instructions differently per group chat.
                  </p>
                </motion.div>
              )}
              {activeFeatureSlide === 5 && (
                <motion.div
                  key="feat5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1 text-center sm:text-left"
                >
                  <h3 className="font-extrabold text-lg text-text-dark">Engagement & Rewards</h3>
                  <p className="text-xs text-muted font-semibold leading-relaxed">
                    Polls, trivia, and learn-and-earn with points — optional cash payouts from a separate RewardAccount.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Large Image Alternator Card Stack */}
          <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl border border-primary/10 overflow-hidden shadow-xl bg-white/40 backdrop-blur-xl">
            <AnimatePresence mode="wait">
              {activeFeatureSlide === 0 && (
                <motion.div
                  key="featslide0"
                  initial={{ y: 200, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 200, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="absolute inset-0"
                >
                  <Image src="/dashboard.png" alt="AI Operations Dashboard" fill className="object-cover object-top" priority />
                </motion.div>
              )}
              {activeFeatureSlide === 1 && (
                <motion.div
                  key="featslide1"
                  initial={{ x: 300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 300, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="absolute inset-0"
                >
                  <Image src="/escalation_dashboard.png" alt="Pending Escalation Approvals" fill className="object-cover object-top" priority />
                </motion.div>
              )}
              {activeFeatureSlide === 2 && (
                <motion.div
                  key="featslide2"
                  initial={{ y: -100, scale: 0.8, opacity: 0 }}
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  exit={{ y: -100, scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 90, damping: 12 }}
                  className="absolute inset-0"
                >
                  <Image src="/handover.png" alt="Shift Handover Logs" fill className="object-cover object-top" priority />
                </motion.div>
              )}
              {activeFeatureSlide === 3 && (
                <motion.div
                  key="featslide3"
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="absolute inset-0"
                >
                  <Image src="/sentry_learns_your_rules.png" alt="Adaptive Playbooks" fill className="object-cover object-top" priority />
                </motion.div>
              )}
              {activeFeatureSlide === 4 && (
                <motion.div
                  key="featslide4"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                >
                  <Image src="/many_roles.png" alt="Dedicated Persona Roles" fill className="object-cover object-top" priority />
                </motion.div>
              )}
              {activeFeatureSlide === 5 && (
                <motion.div
                  key="featslide5"
                  initial={{ y: 150, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -150, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="absolute inset-0"
                >
                  <Image src="/sentry_real_work.png" alt="Engagement and Rewards" fill className="object-cover object-top" priority />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Bullets */}
          <div className="flex justify-center gap-2.5 mt-6">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <button
                key={idx}
                onClick={() => setActiveFeatureSlide(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  activeFeatureSlide === idx ? "w-6 bg-primary" : "w-2.5 bg-primary/20 hover:bg-primary/45 cursor-pointer"
                }`}
                aria-label={`Go to feature slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Publicly verifiable product overview */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">What Sentry actually does</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
              A Telegram employee with visible limits, clear controls, and real billing.
            </h2>
            <p className="text-base text-muted font-medium leading-relaxed">
              Sentry is a community operations agent for Telegram groups. It can answer FAQs, moderate spam, welcome users, summarize activity, host polls and trivia, and optionally run rewards when the employer enables them. It does not claim to be a human employee, a legal fiduciary, or an autonomous custodian of funds.
            </p>
            <p className="text-base text-muted font-medium leading-relaxed">
              The product is designed to be transparent: the employer configures the enabled workflows, funds the prepaid wallet, and reviews any escalations. That makes the work observable and auditable instead of vague marketing copy.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[{ title: "FAQ & support", body: "Answer community questions in chat and send short, targeted follow-ups based on the group’s configured knowledge base." }, { title: "Moderation", body: "Flag suspicious links, warn or filter spam, and surface only high-confidence actions for review." }, { title: "Engagement", body: "Host polls, quizzes, learn-and-earn prompts, and member activities when the group enables them." }, { title: "Reports", body: "Send daily or shift summaries with clear counts: FAQ replies, moderation actions, engagement outcomes, and remaining balance." }].map(({ title, body }) => (
              <div key={title} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
                <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">{title}</div>
                <p className="text-sm font-medium leading-relaxed text-text-dark">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pb-12 sm:pt-8">
        <div className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Publicly verifiable product statement</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-text-dark sm:text-3xl">
            What the page says, what it proves, and what it does not claim
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/10 bg-bg-light p-5">
              <div className="mb-2 text-sm font-extrabold text-text-dark">Visible product evidence</div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                <li>• Sentry is positioned as a Telegram operations agent for FAQ replies, spam moderation, quizzes, and group summaries.</li>
                <li>• The employer controls the enabled workflow, wallet funding, and review settings.</li>
                <li>• The dashboard and work logs are designed to show actions, balances, and summaries in plain language.</li>
                <li>• The billing model is explicit: prepaid wallet and funded workflow controls are part of the product model.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-bg-light p-5">
              <div className="mb-2 text-sm font-extrabold text-text-dark">Claims we avoid</div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                <li>• We do not claim hidden custody, undocumented wallet control, or secret security guarantees.</li>
                <li>• We do not imply autonomous legal or fiduciary control over user funds.</li>
                <li>• We do not present marketing promises without a visible operational workflow and employer review layer.</li>
                <li>• We state only what can be checked from the public product page, the dashboard, and the configured workflows.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">How it works</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">Simple flow, clear accountability.</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[{ step: "1. Enable", copy: "The employer adds Sentry to a Telegram group and chooses which capabilities are allowed: FAQ, moderation, polls, rewards, reports." }, { step: "2. Fund", copy: "The employer funds the prepaid wallet or separate reward account. Billing is a visible, actionable charge model, not an opaque subscription." }, { step: "3. Verify", copy: "The group sees actual outputs: answers, summaries, moderation, reports, and any wallet-linked event logs configured by the employer." }].map(({ step, copy }) => (
            <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm" key={step}>
              <div className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-primary">{step}</div>
              <p className="text-base font-medium leading-relaxed text-text-dark">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
