'use client';

/**
 * TemplateCard Component
 * Displays a workflow template with credential status indicators
 */

import { motion } from 'framer-motion';
import { Zap, CheckCircle, AlertCircle, Loader2, Mail, MessageSquare, Database, FileSpreadsheet, Globe, Users, Bot, Cloud, CreditCard, ShoppingCart, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import CredentialIcon from '@/components/credentials/CredentialIcon';

// Map template icon strings to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'mail': Mail,
  'message-square': MessageSquare,
  'database': Database,
  'sheets': FileSpreadsheet,
  'airtable': Table,
  'globe': Globe,
  'users': Users,
  'bot': Bot,
  'cloud': Cloud,
  'credit-card': CreditCard,
  'shopping-cart': ShoppingCart,
  'zap': Zap,
};

interface CredentialStatus {
  type: string;
  name: string;
  icon: string;
  status: 'available' | 'missing';
  docUrl?: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  required_credentials: CredentialStatus[];
  can_import: boolean;
  // Optional fields from extended template types
  agency_name?: string;
  import_count?: number;
  created_at?: string;
  version?: number;
}

interface TemplateCardProps {
  template: Template;
  onClick: (template: Template) => void;
  index?: number;
  disabled?: boolean;
  loading?: boolean;
}

export default function TemplateCard({ template, onClick, index = 0, disabled = false, loading = false }: TemplateCardProps) {
  const hasCredentials = template.required_credentials.length > 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => !disabled && onClick(template)}
      disabled={disabled}
      className={cn(
        "group bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-left transition-all w-full h-[200px] flex flex-col",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-gray-700 hover:bg-gray-800/30"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gray-800/30 flex items-center justify-center shrink-0">
          {(() => {
            const IconComponent = template.icon ? iconMap[template.icon] : null;
            return IconComponent ? <IconComponent className="h-5 w-5 text-gray-400" /> : <Zap className="h-5 w-5 text-gray-400" />;
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate text-sm">{template.name}</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{template.category || 'Workflow'}</span>
            <span className="text-gray-500">·</span>
            <span className="text-xs text-gray-500">v{template.version ?? 1}</span>
          </div>
        </div>
        {template.can_import ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded-full shrink-0">
            <CheckCircle className="h-3 w-3" />
          </span>
        ) : hasCredentials && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-medium rounded-full shrink-0">
            <AlertCircle className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Description - fixed 2 lines */}
      <p className="text-xs text-gray-400 line-clamp-2 mb-2 min-h-[32px]">
        {template.description || 'No description'}
      </p>

      {/* Credential Icons - single row */}
      <div className="flex gap-1.5 flex-nowrap mb-3 min-h-[28px]">
        {hasCredentials ? (
          <>
            {template.required_credentials.slice(0, 5).map((cred) => (
              <div
                key={cred.type}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  cred.status === 'available'
                    ? 'bg-green-900/30 border border-green-800/50'
                    : 'bg-red-900/30 border border-red-800/50'
                )}
                title={`${cred.name}: ${cred.status === 'available' ? 'Connected' : 'Missing'}`}
              >
                <CredentialIcon
                  type={cred.icon}
                  className={cn(
                    'h-4 w-4',
                    cred.status === 'available' ? 'text-green-400' : 'text-red-400'
                  )}
                />
              </div>
            ))}
            {template.required_credentials.length > 5 && (
              <div className="h-7 px-2 rounded-lg bg-gray-800/30 border border-gray-700 flex items-center text-xs text-gray-400 shrink-0">
                +{template.required_credentials.length - 5}
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-500">No credentials required</span>
        )}
      </div>

      {/* Action Button - fixed height */}
      <div
        className={cn(
          'w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors mt-auto',
          loading
            ? 'bg-gray-400 text-gray-600'
            : 'bg-white text-black group-hover:bg-gray-100'
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Import Workflow
          </>
        )}
      </div>
    </motion.button>
  );
}
