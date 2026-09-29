import React, { useState } from 'react';
import {
  UserCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  FileCode2,
  Send,
  ExternalLink,
  ChevronRight,
  Database,
  Terminal,
  Activity,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { User, AdminConfig } from '../types.js';
import { POSTGRESQL_SCHEMA_SQL, MONGODB_SCHEMA_DOC, DIRECTORY_STRUCTURE_DOC } from '../../server/schemaDocs.js';
import { haptic } from '../services/haptic.js';
import { isAuthorizedAdmin } from '../utils/adminAuth.js';

interface TabProfileProps {
  user: User;
  config: AdminConfig;
  onOpenAdmin: () => void;
  isAdmin?: boolean;
}

export const TabProfile: React.FC<TabProfileProps> = ({
  user,
  config,
  onOpenAdmin,
  isAdmin,
}) => {
  const isUserAdmin = isAdmin !== undefined ? isAdmin : isAuthorizedAdmin(user?.telegramId);
  const [showDocsModal, setShowDocsModal] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    haptic.selection();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      
      {/* 1. PROFILE HEADER CARD */}
      <div className="p-5 rounded-3xl bg-[#121824] border border-[#252D3D] shadow-xl text-center flex flex-col items-center">
        
        {/* Avatar */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#00E5FF] via-[#FFE600] to-[#FF0000] p-0.5 shadow-lg mb-3">
          <div className="w-full h-full rounded-3xl bg-[#0B0E14] flex items-center justify-center font-display font-black text-white text-xl uppercase">
            {user.username ? user.username.slice(0, 2) : 'PO'}
          </div>
        </div>

        <h3 className="text-base font-black text-white">{user.firstName} {user.lastName}</h3>
        <span className="text-xs text-gray-400">@{user.username || 'unknown'}</span>

        {/* Verification & Anti-Cheat Badge */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {user.isFlagged ? (
            <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-xs font-black flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> MULTIPLE DETECTED / FLAGGED
            </span>
          ) : user.isQualified ? (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> QUALIFIED OPERATOR
            </span>
          ) : (
            <span className="px-3 py-1 bg-yellow-500/20 text-[#FFE600] border border-yellow-500/40 rounded-full text-xs font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> REGISTERED MINER
            </span>
          )}
        </div>
      </div>

      {/* 2. SECURITY & HARDWARE FINGERPRINT AUDIT */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
          Client Security & Anti-Cheat Audit
        </span>

        <div className="space-y-1.5 text-xs">
          <div className="p-2.5 bg-[#0B0E14] rounded-xl flex items-center justify-between">
            <span className="text-gray-400">Telegram User ID:</span>
            <span className="font-mono-digits text-white font-bold">{user.telegramId}</span>
          </div>

          <div className="p-2.5 bg-[#0B0E14] rounded-xl flex items-center justify-between">
            <span className="text-gray-400">Device Fingerprint:</span>
            <span className="font-mono-digits text-[#00E5FF] font-semibold truncate max-w-[160px]">
              {user.deviceFingerprint}
            </span>
          </div>

          <div className="p-2.5 bg-[#0B0E14] rounded-xl flex items-center justify-between">
            <span className="text-gray-400">Node IP Protocol:</span>
            <span className="font-mono-digits text-gray-300">{user.ipAddress}</span>
          </div>

          {user.flaggedReason && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-400">
              <b>Flag Reason:</b> {user.flaggedReason}
            </div>
          )}
        </div>
      </div>

      {/* 3. TELEGRAM BOT INTEGRATION */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">POP Telegram Bot</h4>
            <span className="text-[11px] text-gray-400">Direct notifications & alerts</span>
          </div>
        </div>

        <a
          href="http://t.me/PopCornUSA_BOT"
          target="_blank"
          rel="noreferrer"
          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
        >
          <span>Open Bot</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 4. ARCHITECTURE & DATABASE DOCUMENTATION (PROMPT REQUIREMENT) */}
      <div className="p-4 rounded-2xl bg-[#121824] border border-[#252D3D] space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
          Production Architecture & Schemas
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptic.selection();
              setShowDocsModal('postgres');
            }}
            className="p-3 bg-[#0B0E14] hover:bg-[#182133] border border-[#252D3D] rounded-xl text-left transition-all"
          >
            <Database className="w-4 h-4 text-[#00E5FF] mb-1" />
            <div className="text-xs font-bold text-white">PostgreSQL DDL</div>
            <span className="text-[10px] text-gray-500">Relational SQL Schemas</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setShowDocsModal('mongo');
            }}
            className="p-3 bg-[#0B0E14] hover:bg-[#182133] border border-[#252D3D] rounded-xl text-left transition-all"
          >
            <Layers className="w-4 h-4 text-emerald-400 mb-1" />
            <div className="text-xs font-bold text-white">MongoDB Spec</div>
            <span className="text-[10px] text-gray-500">Mongoose Models</span>
          </button>
        </div>

        <button
          onClick={() => {
            haptic.selection();
            setShowDocsModal('architecture');
          }}
          className="w-full p-3 bg-[#0B0E14] hover:bg-[#182133] border border-[#252D3D] rounded-xl flex items-center justify-between text-left transition-all"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#FFE600]" />
            <div>
              <div className="text-xs font-bold text-white">Directory Architecture</div>
              <span className="text-[10px] text-gray-500">Full project structure & modules</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* 5. ADMIN COMMAND CENTER BUTTON (Strictly hidden for regular users, visible ONLY for Telegram ID 7779827146) */}
      {isUserAdmin && (
        <button
          onClick={() => {
            haptic.impact('medium');
            onOpenAdmin();
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all font-display uppercase tracking-wider"
        >
          <Cpu className="w-4 h-4" />
          <span>Open Dynamic Admin Command Center</span>
        </button>
      )}

      {/* SCHEMA VIEWER MODAL */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#121824] border border-[#252D3D] rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2638]">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-[#00E5FF]" />
                <h3 className="text-sm font-black text-white font-display uppercase">
                  {showDocsModal === 'postgres' && 'PostgreSQL Production DDL'}
                  {showDocsModal === 'mongo' && 'MongoDB Mongoose Schema'}
                  {showDocsModal === 'architecture' && 'Directory Architecture Tree'}
                </h3>
              </div>
              <button
                onClick={() => setShowDocsModal(null)}
                className="text-gray-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-3 flex justify-between items-center text-xs">
              <span className="text-gray-400">Complete Schema Specification</span>
              <button
                onClick={() => {
                  const content = showDocsModal === 'postgres'
                    ? POSTGRESQL_SCHEMA_SQL
                    : showDocsModal === 'mongo'
                    ? MONGODB_SCHEMA_DOC
                    : DIRECTORY_STRUCTURE_DOC;
                  handleCopyCode(content);
                }}
                className="py-1 px-2.5 bg-[#1A2234] hover:bg-[#252D3D] text-white rounded-lg flex items-center gap-1 text-[11px]"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy Schema'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#0B0E14] p-3.5 rounded-2xl border border-[#1E2638] text-[11px] font-mono-digits text-gray-300 whitespace-pre-wrap leading-relaxed">
              {showDocsModal === 'postgres' && POSTGRESQL_SCHEMA_SQL}
              {showDocsModal === 'mongo' && MONGODB_SCHEMA_DOC}
              {showDocsModal === 'architecture' && DIRECTORY_STRUCTURE_DOC}
            </div>

            <button
              onClick={() => setShowDocsModal(null)}
              className="mt-4 w-full py-2 bg-[#1A2234] text-white rounded-xl text-xs font-bold hover:bg-[#252D3D] transition-colors"
            >
              Close Viewer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
