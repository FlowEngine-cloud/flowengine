'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import { useTemplatesContext } from './context';
import { FileText, Download, Hash, HelpCircle, X, Lightbulb, Upload, Loader2, CheckCircle, AlertCircle, ChevronDown, Eye, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/SearchableSelect';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import N8nDemo from '@/components/N8nDemo';
import { WorkflowProcessor } from '@/lib/workflowProcessor';

const WORKFLOW_ICONS = [
  '\u26A1', '\uD83D\uDD04', '\uD83E\uDD16', '\u2699\uFE0F', '\uD83D\uDD27', '\uD83D\uDEE0\uFE0F', '\u23F0', '\u23F1\uFE0F',
  '\uD83D\uDCE7', '\uD83D\uDCAC', '\uD83D\uDCE9', '\uD83D\uDCE8', '\u2709\uFE0F', '\uD83D\uDC8C', '\uD83D\uDCE2', '\uD83D\uDCE3',
  '\uD83D\uDCCA', '\uD83D\uDCC8', '\uD83D\uDCC9', '\uD83D\uDCDD', '\uD83D\uDCCB', '\uD83D\uDCC1', '\uD83D\uDCC2', '\uD83D\uDDC2\uFE0F',
  '\uD83D\uDC65', '\uD83C\uDF10', '\uD83D\uDCF1', '\uD83D\uDCBB', '\uD83D\uDDA5\uFE0F', '\uD83D\uDCF2', '\uD83C\uDFAF', '\uD83D\uDCE3',
  '\uD83D\uDED2', '\uD83D\uDCB3', '\uD83D\uDCB0', '\uD83D\uDCB5', '\uD83C\uDFE6', '\uD83E\uDDFE', '\uD83D\uDCE6', '\uD83D\uDE9A',
  '\uD83D\uDD12', '\uD83D\uDD13', '\uD83D\uDD10', '\uD83D\uDEE1\uFE0F', '\uD83D\uDD11', '\uD83D\uDDC4\uFE0F', '\uD83D\uDCBE', '\u2601\uFE0F',
  '\uD83E\uDDE0', '\uD83E\uDD16', '\uD83C\uDFA8', '\uD83D\uDCA1', '\uD83D\uDE80', '\u2728', '\uD83D\uDD2E', '\uD83C\uDFAD',
  '\uD83D\uDCC5', '\uD83D\uDDD3\uFE0F', '\u23F3', '\u231B', '\uD83D\uDD50', '\uD83D\uDCC6', '\uD83C\uDF89', '\uD83C\uDF8A',
  '\uD83C\uDFA7', '\uD83D\uDCBC', '\uD83D\uDCDE', '\uD83E\uDD1D', '\uD83D\uDCAA', '\u2B50', '\uD83C\uDFC6', '\uD83C\uDF96\uFE0F',
  '\uD83D\uDD17', '\uD83D\uDD14', '\uD83C\uDF1F', '\u2764\uFE0F', '\u2705', '\u27A1\uFE0F', '\uD83D\uDD25', '\uD83D\uDC8E',
];

const TEMPLATE_CATEGORIES = [
  { value: 'automation', label: 'Automation' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales & CRM' },
  { value: 'support', label: 'Customer Support' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'finance', label: 'Finance & Accounting' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'social', label: 'Social Media' },
  { value: 'ai', label: 'AI & Machine Learning' },
  { value: 'data', label: 'Data & Analytics' },
  { value: 'hr', label: 'HR & Recruiting' },
  { value: 'devops', label: 'DevOps & IT' },
  { value: 'communication', label: 'Communication' },
  { value: 'other', label: 'Other' },
];

export default function TemplatesPage() {
  const { session } = useAuth();
  const { role } = usePortalRoleContext();
  const { templates, loading, refetch, showAddModal, setShowAddModal } = useTemplatesContext();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Add template form state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadIcon, setUploadIcon] = useState('');
  const [uploadWorkflow, setUploadWorkflow] = useState<any>(null);
  const [extractedCredentials, setExtractedCredentials] = useState<any[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const resetUploadForm = () => {
    setUploadName('');
    setUploadDescription('');
    setUploadCategory('');
    setUploadIcon('');
    setUploadWorkflow(null);
    setExtractedCredentials([]);
    setShowIconPicker(false);
    setJsonText('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const workflow = JSON.parse(content);
      if (workflow.name && !uploadName) setUploadName(workflow.name);
      setJsonText(content);
      setUploadWorkflow(workflow);
      if (workflow.nodes) {
        const creds: any[] = [];
        workflow.nodes.forEach((node: any) => {
          if (node.credentials) {
            Object.keys(node.credentials).forEach((credType) => {
              if (!creds.find(c => c.type === credType)) {
                const name = credType.replace(/Api$/, '').replace(/OAuth2$/, '').replace(/([A-Z])/g, ' $1').trim();
                creds.push({ type: credType, name: name.charAt(0).toUpperCase() + name.slice(1) });
              }
            });
          }
        });
        setExtractedCredentials(creds);
      }
    } catch {
      setToast({ type: 'error', message: 'Invalid JSON file' });
      setUploadWorkflow(null);
      setJsonText('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleJsonPaste = (text: string) => {
    setJsonText(text);
    if (!text.trim()) {
      setUploadWorkflow(null);
      setExtractedCredentials([]);
      return;
    }
    try {
      const workflow = JSON.parse(text);
      if (workflow.name && !uploadName) setUploadName(workflow.name);
      setUploadWorkflow(workflow);
      if (workflow.nodes) {
        const creds: any[] = [];
        workflow.nodes.forEach((node: any) => {
          if (node.credentials) {
            Object.keys(node.credentials).forEach((credType) => {
              if (!creds.find(c => c.type === credType)) {
                const name = credType.replace(/Api$/, '').replace(/OAuth2$/, '').replace(/([A-Z])/g, ' $1').trim();
                creds.push({ type: credType, name: name.charAt(0).toUpperCase() + name.slice(1) });
              }
            });
          }
        });
        setExtractedCredentials(creds);
      }
    } catch {
      setUploadWorkflow(null);
      setExtractedCredentials([]);
    }
  };

  const handleUpload = async () => {
    if (!session || !uploadWorkflow || !uploadName.trim()) return;
    setUploading(true);
    try {
      const res = await fetch('/api/n8n-templates', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uploadName.trim(),
          description: uploadDescription.trim() || null,
          category: uploadCategory.trim() || null,
          icon: uploadIcon || null,
          workflow_json: uploadWorkflow,
        }),
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Template uploaded successfully!' });
        setShowAddModal(false);
        resetUploadForm();
        refetch();
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: data.error || 'Failed to upload template' });
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to upload template' });
    } finally {
      setUploading(false);
    }
  };

  // Get unique categories
  const categories = Array.from(
    new Set(templates.map(t => t.category || 'Uncategorized'))
  ).sort();

  // Filter templates
  const filtered = templates.filter(t => {
    if (selectedCategory !== 'all' && (t.category || 'Uncategorized') !== selectedCategory) return false;
    return true;
  });

  if (loading) return null; // Layout handles skeleton

  if (templates.length === 0) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {role === 'client' ? 'No templates available' : 'No templates yet'}
            </h3>
            <p className="text-white/60 text-base mb-6 max-w-sm">
              {role === 'client'
                ? 'Your agency hasn\'t shared any workflow templates yet.'
                : 'Upload workflow templates to share with your clients.'}
            </p>
            {role !== 'client' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Template
              </button>
            )}
          </div>
        </div>

        {/* Add Template Modal — needed even on empty state */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => { setShowAddModal(false); resetUploadForm(); }}
          >
            <div
              className="w-full max-w-5xl max-h-[90vh] bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
                <h2 className="text-lg font-semibold text-white">Upload Template</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowAddModal(false); resetUploadForm(); }}
                    className="px-4 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadName.trim() || !uploadWorkflow}
                    className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div className="lg:w-1/2 overflow-y-auto p-5 lg:border-r border-gray-800">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1.5">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={uploadName}
                        onChange={(e) => setUploadName(e.target.value)}
                        placeholder="e.g., Slack to Notion Sync"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1.5">Description</label>
                      <textarea
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Brief description..."
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-1.5">Category</label>
                        <SearchableSelect
                          value={uploadCategory}
                          onChange={setUploadCategory}
                          options={[{ value: '', label: 'Select...' }, ...TEMPLATE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))]}
                          placeholder="Select..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-1.5">Icon</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowIconPicker(!showIconPicker)}
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white flex items-center justify-between text-sm cursor-pointer"
                          >
                            <span className={uploadIcon ? 'text-xl' : 'text-gray-500'}>{uploadIcon || 'Select'}</span>
                            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showIconPicker && 'rotate-180')} />
                          </button>
                          {showIconPicker && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setShowIconPicker(false)} />
                              <div className="absolute z-[70] mt-1 w-64 bg-gray-900 border border-gray-800 rounded-lg p-2 shadow-xl">
                                <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                                  {WORKFLOW_ICONS.map((icon, idx) => (
                                    <button
                                      key={`${icon}-${idx}`}
                                      type="button"
                                      onClick={() => { setUploadIcon(icon); setShowIconPicker(false); }}
                                      className={cn('w-7 h-7 rounded flex items-center justify-center text-base hover:bg-gray-800/30 transition-colors cursor-pointer', uploadIcon === icon && 'bg-gray-800/30 ring-1 ring-white')}
                                    >
                                      {icon}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-white/60">
                          Workflow JSON <span className="text-red-400">*</span>
                        </label>
                        <div>
                          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-800/30 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload File
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <textarea
                          value={jsonText}
                          onChange={(e) => handleJsonPaste(e.target.value)}
                          placeholder={'Paste your workflow JSON here or upload a file...\n\n{"name": "My Workflow", "nodes": [...], "connections": {...}}'}
                          className="w-full h-52 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none font-mono text-sm"
                        />
                        {uploadWorkflow && uploadWorkflow.nodes?.length > 0 && (
                          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800 rounded text-sm text-green-400">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Valid - {uploadWorkflow.nodes.length} nodes
                          </div>
                        )}
                        {jsonText && (!uploadWorkflow || !uploadWorkflow.nodes?.length) && (
                          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {uploadWorkflow ? 'Invalid - No nodes' : 'Invalid JSON'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:w-1/2 flex flex-col overflow-hidden bg-black/50">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-white">Preview</span>
                    </div>
                    {uploadWorkflow && <span className="text-sm text-gray-500">{uploadWorkflow.nodes?.length || 0} nodes</span>}
                  </div>
                  <div className="flex-1 min-h-[250px]">
                    {uploadWorkflow ? (
                      <N8nDemo workflow={WorkflowProcessor.ensureAIAgentStructure(uploadWorkflow)} />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-xl bg-gray-800/30 flex items-center justify-center mx-auto mb-3">
                            <FileText className="h-6 w-6 text-gray-500" />
                          </div>
                          <p className="text-gray-500 text-sm">Add workflow to preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {extractedCredentials.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/50 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-white/60">Required Credentials</span>
                        <span className="text-sm text-gray-500">({extractedCredentials.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {extractedCredentials.map((cred) => (
                          <div key={cred.type} className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/30 border border-gray-700 rounded text-sm">
                            <CredentialIcon type={cred.type} fallback="key" className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-white">{cred.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-green-900/90 text-green-400 border border-green-800' : 'bg-red-900/90 text-red-400 border border-red-800'
          }`}>
            {toast.message}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4">
        {/* Category Filter */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                selectedCategory === 'all'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-800'
              )}
            >
              All ({templates.length})
            </button>
            {categories.map(cat => {
              const count = templates.filter(t => (t.category || 'Uncategorized') === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                    selectedCategory === cat
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-800'
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition-all text-sm"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>

        {/* Template Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No templates match your search</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(template => (
              <button
                key={template.id}
                onClick={() => router.push(`/portal/templates/${template.id}`)}
                className="group bg-gray-900/50 border border-gray-800 hover:border-gray-600 rounded-xl p-5 text-left transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-lg shrink-0">
                    {template.icon || '\u26A1'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-white/90">
                      {template.name}
                    </h3>
                    {template.category && (
                      <span className="text-sm text-white/40">{template.category}</span>
                    )}
                  </div>
                </div>
                {template.description && (
                  <p className="text-sm text-white/50 line-clamp-2 mb-3">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-sm text-white/30">
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {template.import_count}
                  </span>
                  {template.version && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      v{template.version}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setShowHelpModal(false)}>
          <div
            className="w-full max-w-lg bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium">How Templates Work</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium mb-1">Upload Workflow Templates</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Upload your n8n workflow JSON files as reusable templates. Use <span className="text-white font-medium">+ New</span> to add one with full details, or <span className="text-white font-medium">Bulk</span> to import multiple at once.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium mb-1">Organize by Category</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Group templates into categories so clients can easily browse and find the workflows they need. Add descriptions and icons to each template.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium mb-1">Clients Import &amp; Use</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Clients can browse your shared templates and import them directly into their n8n instance with one click, ready to customize and run.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/60">
                      <span className="font-medium text-white">Pro tip:</span> Version your templates to track changes. Clients will always see the latest version when they import.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => { setShowAddModal(false); resetUploadForm(); }}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="text-lg font-semibold text-white">Upload Template</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowAddModal(false); resetUploadForm(); }}
                  className="px-4 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadName.trim() || !uploadWorkflow}
                  className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Two Column Content */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Left Column - Form */}
              <div className="lg:w-1/2 overflow-y-auto p-5 lg:border-r border-gray-800">
                <div className="space-y-4">
                  {/* Template Name */}
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g., Slack to Notion Sync"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Brief description..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none text-sm"
                    />
                  </div>

                  {/* Category & Icon */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1.5">
                        Category
                      </label>
                      <SearchableSelect
                        value={uploadCategory}
                        onChange={setUploadCategory}
                        options={[{ value: '', label: 'Select...' }, ...TEMPLATE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))]}
                        placeholder="Select..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1.5">
                        Icon
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(!showIconPicker)}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white flex items-center justify-between text-sm cursor-pointer"
                        >
                          <span className={uploadIcon ? 'text-xl' : 'text-gray-500'}>
                            {uploadIcon || 'Select'}
                          </span>
                          <ChevronDown className={cn(
                            'h-4 w-4 text-gray-400 transition-transform',
                            showIconPicker && 'rotate-180'
                          )} />
                        </button>
                        {showIconPicker && (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setShowIconPicker(false)} />
                            <div className="absolute z-[70] mt-1 w-64 bg-gray-900 border border-gray-800 rounded-lg p-2 shadow-xl">
                              <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                                {WORKFLOW_ICONS.map((icon, idx) => (
                                  <button
                                    key={`${icon}-${idx}`}
                                    type="button"
                                    onClick={() => { setUploadIcon(icon); setShowIconPicker(false); }}
                                    className={cn(
                                      'w-7 h-7 rounded flex items-center justify-center text-base hover:bg-gray-800/30 transition-colors cursor-pointer',
                                      uploadIcon === icon && 'bg-gray-800/30 ring-1 ring-white'
                                    )}
                                  >
                                    {icon}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Workflow JSON Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-white/60">
                        Workflow JSON <span className="text-red-400">*</span>
                      </label>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-800/30 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload File
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <textarea
                        value={jsonText}
                        onChange={(e) => handleJsonPaste(e.target.value)}
                        placeholder={'Paste your workflow JSON here or upload a file...\n\n{"name": "My Workflow", "nodes": [...], "connections": {...}}'}
                        className="w-full h-52 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none font-mono text-sm"
                      />
                      {uploadWorkflow && uploadWorkflow.nodes?.length > 0 && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800 rounded text-sm text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Valid - {uploadWorkflow.nodes.length} nodes
                        </div>
                      )}
                      {jsonText && (!uploadWorkflow || !uploadWorkflow.nodes?.length) && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {uploadWorkflow ? 'Invalid - No nodes' : 'Invalid JSON'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Preview */}
              <div className="lg:w-1/2 flex flex-col overflow-hidden bg-black/50">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-white">Preview</span>
                  </div>
                  {uploadWorkflow && (
                    <span className="text-sm text-gray-500">{uploadWorkflow.nodes?.length || 0} nodes</span>
                  )}
                </div>
                <div className="flex-1 min-h-[250px]">
                  {uploadWorkflow ? (
                    <N8nDemo workflow={WorkflowProcessor.ensureAIAgentStructure(uploadWorkflow)} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-xl bg-gray-800/30 flex items-center justify-center mx-auto mb-3">
                          <FileText className="h-6 w-6 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-sm">Add workflow to preview</p>
                      </div>
                    </div>
                  )}
                </div>
                {extractedCredentials.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/50 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-white/60">Required Credentials</span>
                      <span className="text-sm text-gray-500">({extractedCredentials.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {extractedCredentials.map((cred) => (
                        <div
                          key={cred.type}
                          className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/30 border border-gray-700 rounded text-sm"
                        >
                          <CredentialIcon type={cred.type} fallback="key" className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-white">{cred.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-400 border border-green-800' : 'bg-red-900/90 text-red-400 border border-red-800'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
