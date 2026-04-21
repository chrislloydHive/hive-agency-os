'use client';

// app/c/[companyId]/tasks/TasksClient.tsx
// My Day — Full client component
//
// Views: Tasks | Brain Dump | Projects | Archive
// Features: search, status/priority filters, sort, checkboxes, mobile-responsive

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TaskEditPanel } from '@/app/tasks/command-center/TaskEditPanel';
import {
  Search,
  Mail,
  Brain,
  FolderKanban,
  Archive,
  FileText,
  Paperclip,
  ExternalLink,
  CheckSquare,
  Square,
  ChevronDown,
  Filter,
  ArrowUpDown,
  ChevronRight,
  X,
  Plus,
  Inbox,
  BarChart3,
  Table2,
  StickyNote,
  ChevronUp,
  ArrowRightCircle,
  Target,
  UserPlus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
}

export interface TasksClientProps {
  company?: CompanyData;
}

interface TaskItem {
  id: number;
  airtableId?: string;
  task: string;
  pri: Priority;
  due: string;
  from: string;
  project: string;
  nextAction: string;
  status: TaskStatus;
  threadUrl: string | null;
  draftUrl: string | null;
  attachUrl: string | null;
  notes: string;
  assignedTo: string;
  checked: boolean;
  view: ViewType;
  /** When completing via checkbox, store row state so undo restores the right tab + status */
  priorStatusBeforeDone?: TaskStatus;
  priorViewBeforeDone?: ViewType;
}

type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type TaskStatus = 'Next' | 'Inbox' | 'Waiting' | 'Done' | 'Archive';
type ViewType = 'inbox' | 'braindump' | 'projects' | 'archive';
type SortKey = 'pri' | 'due' | 'status';

// ============================================================================
// Config
// ============================================================================

const PRI_CONFIG: Record<Priority, { bg: string; text: string; border: string; dot: string }> = {
  P0: { bg: 'bg-red-950', text: 'text-red-400', border: 'border-red-800', dot: 'bg-red-500' },
  P1: { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800', dot: 'bg-orange-400' },
  P2: { bg: 'bg-yellow-950', text: 'text-yellow-400', border: 'border-yellow-800', dot: 'bg-yellow-400' },
  P3: { bg: 'bg-green-950', text: 'text-green-400', border: 'border-green-800', dot: 'bg-green-400' },
};

const STATUS_CONFIG: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  Next: { bg: 'bg-teal-950', text: 'text-teal-400', border: 'border-teal-800' },
  Inbox: { bg: 'bg-blue-950', text: 'text-blue-400', border: 'border-blue-800' },
  Waiting: { bg: 'bg-amber-950', text: 'text-amber-400', border: 'border-amber-800' },
  Done: { bg: 'bg-emerald-950', text: 'text-emerald-400', border: 'border-emerald-800' },
  Archive: { bg: 'bg-gray-800', text: 'text-gray-500', border: 'border-gray-700' },
};

const VIEW_TABS: { id: ViewType; label: string; icon: typeof Mail }[] = [
  { id: 'inbox', label: 'Tasks', icon: Inbox },
  { id: 'braindump', label: 'Brain Dump', icon: Brain },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'archive', label: 'Archive', icon: Archive },
];

// ============================================================================
// Seed Data (will be replaced by API calls)
// ============================================================================

const SEED_TASKS: TaskItem[] = [
  { id: 1, task: 'Kiana - invoice status', pri: 'P0', due: 'Apr 10', from: 'Kiana Sua', project: 'Car Toys / Billing', nextAction: 'Confirm with Kim: (1) did first weekly invoice go out? (2) is $60,800.50 Invoice 1085 separate or rolled in? (3) did remaining Q1 $68,147.', status: 'Next', threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d354da7d1795e1', draftUrl: 'https://mail.google.com/mail/u/0/#drafts/19d78aea52dbfd97', attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 2, task: 'Eric financials package', pri: 'P0', due: 'Apr 14', from: 'Robert Baur', project: 'HEY / Eric Request', nextAction: 'Eric wants accounting done ~May 17 (2 wks earlier). Confirm revised timeline with Robert Baur and reply to Eric.', status: 'Next', threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d21cb6ea54d541', draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 3, task: 'Spokane geofence rerun', pri: 'P1', due: 'Apr 9', from: 'Jim Warren', project: 'Car Toys 2026 Media', nextAction: 'Pull geofence cost/reach data for Spokane at 10mi and 20mi and send revised estimates to Jim.', status: 'Inbox', threadUrl: 'https://mail.google.com/mail/u/0/#inbox/19d6a58c78785bd5', draftUrl: 'https://mail.google.com/mail/u/0/#drafts/19d78aede3a47a6e', attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 4, task: 'GDrive folder for BT assets', pri: 'P1', due: 'Apr 11', from: 'Internal', project: 'Car Toys 2026 Media', nextAction: 'Generate Google Drive folder with approved assets as soon as approvals come in. Brkthru waiting.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 5, task: 'Dolby Atmos theater pricing', pri: 'P1', due: 'Apr 11', from: 'Nolan Gauvreau', project: 'Car Toys / Dolby Atmos', nextAction: 'Pick pricing: $20 net Seattle, $30 net Denver, or $25 CPM blended. Reply to Nolan.', status: 'Next', threadUrl: 'https://mail.google.com/mail/u/0/#all/19d6d6db90ac54c1', draftUrl: 'https://mail.google.com/mail/u/0/#drafts?compose=19d78aed5463f1b0', attachUrl: 'https://docs.google.com/document/d/1H8Pjxij-yx3kFiH8KpH_ASfj3on0nVyJZyKfAdvYCYA/edit', notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 6, task: 'Adam J. GeoFence sign-off', pri: 'P1', due: 'Apr 11', from: 'Adam Jovanovich', project: 'Car Toys Tint', nextAction: 'Jim approved competitor conquesting test. Adam needs to sign off to unblock launch.', status: 'Waiting', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 7, task: 'Creative Rotation re-review', pri: 'P1', due: 'Apr 11', from: 'Jim Warren', project: 'Car Toys 2026 Media', nextAction: 'Jim made additional changes to the Creative Rotation spreadsheet — review latest edits, update rotation plan.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 8, task: "Reply D'Nisha Missing Assets", pri: 'P1', due: 'Apr 13', from: "D'Nisha Hand", project: 'Car Toys Tint', nextAction: "TWO DRAFTS: (1) Internal to Andy+Louie — asset status — in Docs link. (2) Reply to D'Nisha — in Draft link. Send internal first.", status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 9, task: 'Review BT Geofence Recs', pri: 'P1', due: 'Apr 13', from: 'Nolan Gauvreau', project: 'Car Toys 2026 Media', nextAction: '60-70% budget to top-converting fences, 30-40% to awareness. Send top 7 new Denver geofences.', status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 10, task: 'Eric financials — reply to Eric', pri: 'P1', due: 'Apr 13', from: 'Eric Gutierrez', project: 'HEY / Eric Request', nextAction: 'Eric replied 4/10: wants accounting sooner. Confirm revised timeline with Robert, reply to Eric.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 11, task: 'KC001630 RFP Response', pri: 'P1', due: 'Apr 27', from: 'Stephanie Wong (King Co.)', project: 'Hive New Biz', nextAction: 'King County Federal Gov Relations Consultant RFP. Closes 4/27. Review PDF, decide whether to bid under HEY LLC.', status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 12, task: 'Budget sync with Nolan', pri: 'P2', due: 'Apr 11', from: 'Nolan Gauvreau', project: 'Car Toys / Billing', nextAction: 'Schedule 30-min working session to walk through master budget sheet and tracker alignment.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 13, task: 'Reconnect BofA Intuit Access', pri: 'P2', due: 'Apr 13', from: 'Bank of America', project: 'Hive Billing', nextAction: 'BofA stopped sharing data with Intuit on 4/10. Log in and reconnect integration.', status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 14, task: 'Miller Nash legal check-in', pri: 'P2', due: 'Apr 13', from: 'Andrew Liese', project: 'Legal', nextAction: 'Confirm meeting occurred; capture any follow-ups.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 15, task: 'Fix Vercel Deployment', pri: 'P2', due: 'Apr 14', from: 'Vercel', project: 'Hive Admin', nextAction: 'hive-agency-os production deployment failed twice on 4/10. Check dashboard, fix build, redeploy.', status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 16, task: 'Fix Production Checklist Script', pri: 'P2', due: 'Apr 14', from: 'Google Apps Script', project: 'Hive Admin', nextAction: "Apps Script 'Production Checklist Generator' failing. Review error log, fix or disable trigger.", status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 17, task: 'Brkthru media items', pri: 'P2', due: 'Apr 14', from: 'Nolan Gauvreau', project: 'Car Toys 2026 Media', nextAction: 'Nolan acknowledged 4-item email. Follow up if no response by EOD Monday.', status: 'Waiting', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 18, task: 'Adam Weil accessibility follow-up', pri: 'P2', due: 'Apr 14', from: 'Adam Weil', project: 'Portage Bank', nextAction: 'Clarify expectations for Portage Bank remediation scope with White Rabbit.', status: 'Next', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 19, task: 'Adam — IG Stories approval', pri: 'P2', due: 'Apr 15', from: 'Adam Jovanovich', project: 'Car Toys Tint', nextAction: "Chris sent two new IG Stories assets to Adam's portal. Follow up if no response by Tuesday.", status: 'Waiting', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 20, task: 'Tint Fences Friday agenda', pri: 'P2', due: 'Apr 17', from: 'Nolan Gauvreau', project: 'Car Toys Tint', nextAction: 'Nolan adding \'Tint Fences\' to Friday agenda — prep thoughts on prospect vs. competitor fence mix.', status: 'Waiting', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
  { id: 21, task: 'WSDOT Comms Consultant Bid', pri: 'P3', due: 'May 26', from: 'WEBS (WA DES)', project: 'Hive New Biz', nextAction: 'WSDOT Comms Consultant RFQ. ~$135K. Closes May 26. Review solicitation and decide whether to bid.', status: 'Inbox', threadUrl: null, draftUrl: null, attachUrl: null, notes: '', assignedTo: '', checked: false, view: 'inbox' },
];

// ============================================================================
// Sub-components
// ============================================================================

function PriorityPill({ pri }: { pri: Priority }) {
  const c = PRI_CONFIG[pri] || PRI_CONFIG.P2;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {pri}
    </span>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.Inbox;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}>
      {status}
    </span>
  );
}

function LinkIcon({ url, icon: Icon, color, title }: { url: string | null; icon: typeof ExternalLink; color: string; title: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={title}
       className={`${color} hover:opacity-70 transition-opacity p-1`}>
      <Icon size={15} strokeWidth={2.2} />
    </a>
  );
}

/** Pill-style link button for expanded task detail */
function LinkPill({ url, icon: Icon, label, color, bgColor }: { url: string | null; icon: typeof ExternalLink; label: string; color: string; bgColor: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${color} ${bgColor} rounded-md hover:opacity-80 transition-opacity`}
       onClick={(e) => e.stopPropagation()}>
      <Icon size={12} />
      {label}
    </a>
  );
}

const AIRTABLE_TABLE_ID = 'tblf7wEI0KBwysrQz';
const AIRTABLE_BASE_ID_LINK = 'appVLDjqK2q4IJhGz';

function getAirtableUrl(recordId?: string) {
  if (!recordId) return null;
  return `https://airtable.com/${AIRTABLE_BASE_ID_LINK}/${AIRTABLE_TABLE_ID}/${recordId}`;
}

function StatCard({ label, value, color, borderColor }: { label: string; value: number; color: string; borderColor: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg border ${color} ${borderColor}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs font-medium opacity-60 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function MobileTaskCard({ t, onToggle, onExpand, expanded, onMove }: { t: TaskItem; onToggle: (id: number) => void; onExpand: (id: number) => void; expanded: boolean; onMove?: (t: TaskItem) => void }) {
  const isOverdue = new Date(t.due + ' 2025') < new Date();
  const hasLinks = t.threadUrl || t.draftUrl || t.attachUrl;
  return (
    <div id={`task-${t.airtableId}`} className={`border-b border-gray-800 ${t.checked ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => onExpand(t.id)}>
        <button onClick={e => { e.stopPropagation(); onToggle(t.id); }} className="mt-0.5 flex-shrink-0">
          {t.checked
            ? <CheckSquare size={20} className="text-green-500" />
            : <Square size={20} className="text-gray-600" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityPill pri={t.pri} />
            <StatusPill status={t.status} />
            {isOverdue && <span className="text-xs text-red-400 font-medium">OVERDUE</span>}
          </div>
          <p className={`text-sm font-medium mt-1.5 ${t.checked ? 'line-through text-gray-500' : 'text-gray-100'}`}>
            {t.task}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{t.due}</span>
            <span className="text-gray-700">&middot;</span>
            {(() => {
              const owner = t.assignedTo || 'Chris';
              const isMe = owner.toLowerCase().startsWith('chris');
              return isMe ? (
                <span className="truncate">Chris</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40 truncate">
                  <UserPlus size={10} className="shrink-0" />
                  {owner.split(' ')[0]}
                </span>
              );
            })()}
          </div>
        </div>
        <ChevronRight size={16} className={`text-gray-600 mt-2 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-2">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Project</div>
            <div className="text-sm text-gray-300">{t.project}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Next Action</div>
            <p className="text-sm text-gray-300 leading-relaxed">{t.nextAction}</p>
          </div>
          {t.notes && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
              <p className="text-sm text-gray-400 leading-relaxed">{t.notes}</p>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <LinkPill url={t.threadUrl} icon={Mail} label="Thread" color="text-blue-300" bgColor="bg-blue-950/60 border border-blue-800/40" />
            <LinkPill url={t.draftUrl} icon={FileText} label="Draft" color="text-green-300" bgColor="bg-green-950/60 border border-green-800/40" />
            <LinkPill url={t.attachUrl} icon={t.attachUrl?.includes('drafts') ? FileText : Paperclip} label={t.attachUrl?.includes('drafts') ? 'Internal Draft' : 'Attach'} color="text-purple-300" bgColor="bg-purple-950/60 border border-purple-800/40" />
            <LinkPill url={getAirtableUrl(t.airtableId)} icon={Table2} label="Airtable" color="text-amber-300" bgColor="bg-amber-950/60 border border-amber-800/40" />
            {onMove && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove(t); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-md transition-colors"
              >
                <ArrowRightCircle size={12} />
                Move to Tasks
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty State for Brain Dump / Projects / Archive
// ============================================================================

function EmptyViewState({ view }: { view: ViewType }) {
  const config = {
    braindump: {
      icon: Brain,
      title: 'Brain Dump',
      description: 'Quick-capture ideas, random todos, and things you don\'t want to forget. No structure required.',
      cta: 'Add a thought',
    },
    projects: {
      icon: FolderKanban,
      title: 'Projects',
      description: 'Tasks grouped by project and client. Drag items here from Tasks once triaged.',
      cta: 'Create a project',
    },
    archive: {
      icon: Archive,
      title: 'Archive',
      description: 'Completed and dismissed tasks. Check off items in Tasks to move them here.',
      cta: null,
    },
    inbox: {
      icon: Inbox,
      title: 'All Clear',
      description: 'All caught up. New tasks will appear here as emails arrive.',
      cta: null,
    },
  };

  const c = config[view];
  const IconComponent = c.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
        <IconComponent size={28} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mb-2">{c.title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{c.description}</p>
      {c.cta && (
        <button
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>('input[placeholder*="Dump"], input[placeholder*="Quick-add"]');
            if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg hover:bg-amber-950/60 transition-colors"
        >
          <Plus size={16} />
          {c.cta}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TasksClient({ company }: TasksClientProps) {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get('task');
  const deepLinkHandled = useRef(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('inbox');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPri, setFilterPri] = useState('All');
  const [sortBy, setSortBy] = useState<SortKey>('pri');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriDropdown, setShowPriDropdown] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingAirtableId, setEditingAirtableId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [parseStatus, setParseStatus] = useState<string>('');

  const addTask = useCallback(async (text: string, view: ViewType) => {
    if (!text.trim() || addingTask) return;
    setAddingTask(true);
    setParseStatus('');

    try {
      let taskData: {
        task: string; priority: string; status: string; from: string;
        project: string; nextAction: string; due: string;
      } = {
        task: text.trim(),
        priority: 'P2',
        status: 'Inbox',
        from: 'Chris Lloyd',
        project: '',
        nextAction: '',
        due: '',
      };

      // For brain dump items, use AI to parse raw text into a structured task
      if (view === 'braindump' && text.trim().length > 30) {
        setParseStatus('Parsing with AI...');
        try {
          const parseRes = await fetch('/api/os/tasks/parse-dump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }),
          });
          if (parseRes.ok) {
            const { parsed } = await parseRes.json();
            taskData = {
              task: parsed.task || taskData.task,
              priority: parsed.priority || 'P2',
              status: parsed.status || 'Inbox',
              from: parsed.from || 'Chris Lloyd',
              project: parsed.project || '',
              nextAction: parsed.nextAction || '',
              due: parsed.due || '',
            };
            setParseStatus('Creating task...');
          }
        } catch (parseErr) {
          console.error('AI parse failed, saving raw:', parseErr);
          // Fall through — save as raw text if AI fails
        }
      }

      const res = await fetch('/api/os/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskData,
          view,
          done: false,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      const t = data.task;
      const newItem: TaskItem = {
        id: tasks.length + 1,
        airtableId: t.id,
        task: t.task || taskData.task,
        pri: (t.priority || 'P2') as Priority,
        due: t.due || '',
        from: t.from || 'Chris Lloyd',
        project: t.project || '',
        nextAction: t.nextAction || '',
        status: (t.status || 'Inbox') as TaskStatus,
        threadUrl: t.threadUrl || null,
        draftUrl: t.draftUrl || null,
        attachUrl: t.attachUrl || null,
        notes: t.notes || '',
        assignedTo: t.assignedTo || '',
        checked: false,
        view: (t.view || view) as ViewType,
      };
      setTasks(prev => [newItem, ...prev]);
      setNewTaskText('');
      setParseStatus('');
    } catch (err) {
      console.error('Failed to add task:', err);
      setParseStatus('');
    } finally {
      setAddingTask(false);
    }
  }, [addingTask, tasks.length]);

  // Fetch tasks from Airtable
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/os/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      const mapped: TaskItem[] = (data.tasks || []).map((t: any, i: number) => ({
        id: i + 1,
        airtableId: t.id,
        task: t.task || '',
        pri: t.priority || 'P2',
        due: t.due || '',
        from: t.from || '',
        project: t.project || '',
        nextAction: t.nextAction || '',
        status: t.status || 'Inbox',
        threadUrl: t.threadUrl || null,
        draftUrl: t.draftUrl || null,
        attachUrl: t.attachUrl || null,
        notes: t.notes || '',
        assignedTo: t.assignedTo || '',
        checked: t.done || false,
        view: t.view || 'inbox',
      }));
      setTasks(mapped.length > 0 ? mapped : SEED_TASKS);
    } catch (err) {
      console.error('Failed to fetch tasks, using seed data:', err);
      setTasks(SEED_TASKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Gmail sync: fire-and-forget on mount. The endpoint has its own mutex +
  // 30-second cooldown so concurrent/rapid calls are safely no-ops.
  const gmailSyncFired = useRef(false);
  useEffect(() => {
    if (gmailSyncFired.current) return;
    gmailSyncFired.current = true;
    let cancelled = false;
    fetch('/api/os/tasks/sync-gmail', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.synced > 0) fetchTasks();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchTasks]);

  // Deep-link: auto-expand a task when ?task=recXXX is in the URL
  useEffect(() => {
    if (!deepLinkTaskId || deepLinkHandled.current || loading || tasks.length === 0) return;
    deepLinkHandled.current = true;
    const match = tasks.find(t => t.airtableId === deepLinkTaskId);
    if (match) {
      // Switch to the correct view if needed
      if (match.view && match.view !== activeView) {
        setActiveView(match.view as ViewType);
      }
      setExpandedId(match.id);
      // Scroll to the task after a short delay for render
      setTimeout(() => {
        const el = document.getElementById(`task-${match.airtableId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [deepLinkTaskId, loading, tasks, activeView]);

  const toggleCheck = useCallback((id: number) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        const nowChecked = !t.checked;
        // If checking done → archive immediately (UI + server merge use view=archive)
        if (nowChecked) {
          return {
            ...t,
            checked: true,
            status: 'Done' as TaskStatus,
            view: 'archive' as ViewType,
            priorStatusBeforeDone: t.status,
            priorViewBeforeDone: t.view,
          };
        }
        const priorS = t.priorStatusBeforeDone ?? ('Inbox' as TaskStatus);
        const priorV = t.priorViewBeforeDone ?? ('inbox' as ViewType);
        return {
          ...t,
          checked: false,
          status: priorS,
          view: priorV,
          priorStatusBeforeDone: undefined,
          priorViewBeforeDone: undefined,
        };
      });
      // Persist to Airtable (updateTask merges Done → archive; uncheck restores prior status + view)
      const task = updated.find(t => t.id === id);
      if (task?.airtableId) {
        const payload: Record<string, unknown> = {
          id: task.airtableId,
          done: task.checked,
        };
        if (task.checked) {
          payload.status = 'Done';
          payload.view = 'archive';
        } else {
          payload.status = task.status;
          payload.view = task.view;
        }
        fetch('/api/os/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(err => console.error('Failed to update task:', err));
      }
      return updated;
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const moveToTasks = useCallback(async (taskItem: TaskItem) => {
    try {
      const res = await fetch('/api/os/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskItem.airtableId, view: 'inbox' }),
      });
      if (!res.ok) throw new Error('Failed to move task');
      setTasks(prev => prev.map(t =>
        t.id === taskItem.id ? { ...t, view: 'inbox' as ViewType } : t
      ));
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  }, []);

  // Filter tasks for the active tab (Tasks = inbox). Hide Done rows that are still
  // mis-filed as inbox until backfill / server merge corrects them.
  const viewTasks = useMemo(() => {
    if (activeView === 'inbox') {
      return tasks.filter(t => t.view === 'inbox' && t.status !== 'Done');
    }
    return tasks.filter(t => t.view === activeView);
  }, [tasks, activeView]);

  const filtered = useMemo(() => {
    let result = viewTasks.filter(t => {
      if (search && !t.task.toLowerCase().includes(search.toLowerCase()) &&
          !t.from.toLowerCase().includes(search.toLowerCase()) &&
          !t.nextAction.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'All' && t.status !== filterStatus) return false;
      if (filterPri !== 'All' && t.pri !== filterPri) return false;
      return true;
    });

    const priOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const statOrder: Record<string, number> = { Inbox: 0, Next: 1, Waiting: 2, Done: 3, Archive: 4 };

    if (sortBy === 'pri') {
      result.sort((a, b) => priOrder[a.pri] - priOrder[b.pri]);
    } else if (sortBy === 'due') {
      result.sort((a, b) => new Date(a.due + ' 2026').getTime() - new Date(b.due + ' 2026').getTime());
    } else if (sortBy === 'status') {
      result.sort((a, b) => statOrder[a.status] - statOrder[b.status]);
    }
    return result;
  }, [viewTasks, search, filterStatus, filterPri, sortBy]);

  const stats = useMemo(() => {
    const active = viewTasks.filter(t => !t.checked);
    return {
      total: active.length,
      urgent: active.filter(t => t.pri === 'P0').length,
      inbox: active.filter(t => t.status === 'Inbox').length,
      next: active.filter(t => t.status === 'Next').length,
      waiting: active.filter(t => t.status === 'Waiting').length,
    };
  }, [viewTasks]);

  const activeFilters = (filterStatus !== 'All' ? 1 : 0) + (filterPri !== 'All' ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Mail size={16} className="text-gray-900" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">MY DAY</h1>
                {company?.name && <p className="text-xs text-gray-500 hidden sm:block">{company.name}</p>}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href={company?.id ? `/c/${company.id}/tasks/summary` : '/tasks/summary'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg hover:bg-amber-950/60 transition-colors"
              >
                <BarChart3 size={13} />
                Daily Summary
              </Link>
              <Link
                href="/tasks/command-center"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg hover:bg-emerald-950/60 transition-colors"
              >
                <Target size={13} />
                Command Center
              </Link>
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-gray-900/80 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {VIEW_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              const count = tasks.filter(t => t.view === tab.id && !t.checked).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveView(tab.id); setExpandedId(null); }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-amber-950 text-amber-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Bar — only shown for tasks view */}
      {activeView === 'inbox' && (
        <div className="bg-gray-900/50 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            {/* Desktop stats */}
            <div className="hidden sm:flex items-center gap-3">
              <StatCard label="Tasks" value={stats.total} color="bg-gray-800/60 text-gray-300" borderColor="border-gray-700" />
              <StatCard label="Urgent" value={stats.urgent} color="bg-red-950/40 text-red-400" borderColor="border-red-900/50" />
              <StatCard label="New" value={stats.inbox} color="bg-blue-950/40 text-blue-400" borderColor="border-blue-900/50" />
              <StatCard label="Next" value={stats.next} color="bg-teal-950/40 text-teal-400" borderColor="border-teal-900/50" />
              <StatCard label="Waiting" value={stats.waiting} color="bg-amber-950/40 text-amber-400" borderColor="border-amber-900/50" />
            </div>
            {/* Mobile stats */}
            <div className="flex sm:hidden items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700">
                <div className="text-lg font-bold text-gray-300">{stats.total}</div>
                <div className="text-xs text-gray-500">All</div>
              </div>
              <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/50">
                <div className="text-lg font-bold text-red-400">{stats.urgent}</div>
                <div className="text-xs text-red-500/60">P0</div>
              </div>
              <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-900/50">
                <div className="text-lg font-bold text-blue-400">{stats.inbox}</div>
                <div className="text-xs text-blue-500/60">New</div>
              </div>
              <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg bg-teal-950/40 border border-teal-900/50">
                <div className="text-lg font-bold text-teal-400">{stats.next}</div>
                <div className="text-xs text-teal-500/60">Next</div>
              </div>
              <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-900/50">
                <div className="text-lg font-bold text-amber-400">{stats.waiting}</div>
                <div className="text-xs text-amber-500/60">Wait</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="Search tasks..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 bg-gray-800 text-gray-200 placeholder-gray-500" />
          </div>

          {/* Mobile filter toggle */}
          <button onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="sm:hidden flex items-center gap-1 px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 text-gray-300">
            <Filter size={14} />
            {activeFilters > 0 && <span className="w-4 h-4 rounded-full bg-amber-500 text-gray-900 text-xs flex items-center justify-center font-bold">{activeFilters}</span>}
          </button>

          {/* Desktop filters */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Status Filter */}
            <div className="relative">
              <button onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowPriDropdown(false); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
                <Filter size={14} />
                <span>{filterStatus === 'All' ? 'Status' : filterStatus}</span>
                <ChevronDown size={14} />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-28">
                  {['All', 'Inbox', 'Next', 'Waiting', 'Done'].map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setShowStatusDropdown(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 ${filterStatus === s ? 'font-semibold text-amber-400' : 'text-gray-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <button onClick={() => { setShowPriDropdown(!showPriDropdown); setShowStatusDropdown(false); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
                <Filter size={14} />
                <span>{filterPri === 'All' ? 'Priority' : filterPri}</span>
                <ChevronDown size={14} />
              </button>
              {showPriDropdown && (
                <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-28">
                  {['All', 'P0', 'P1', 'P2', 'P3'].map(p => (
                    <button key={p} onClick={() => { setFilterPri(p); setShowPriDropdown(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 ${filterPri === p ? 'font-semibold text-amber-400' : 'text-gray-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <button onClick={() => setSortBy(prev => prev === 'pri' ? 'due' : prev === 'due' ? 'status' : 'pri')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
              <ArrowUpDown size={14} />
              <span>{sortBy === 'pri' ? 'Priority' : sortBy === 'due' ? 'Due' : 'Status'}</span>
            </button>
          </div>
        </div>

        {/* Mobile filter panel */}
        {mobileFilterOpen && (
          <div className="sm:hidden mt-2 p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Filters</span>
              <button onClick={() => setMobileFilterOpen(false)}><X size={16} className="text-gray-500" /></button>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Status</div>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Inbox', 'Next', 'Waiting', 'Done'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 text-xs rounded-full border ${filterStatus === s ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Priority</div>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'P0', 'P1', 'P2', 'P3'].map(p => (
                  <button key={p} onClick={() => setFilterPri(p)}
                    className={`px-2.5 py-1 text-xs rounded-full border ${filterPri === p ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Sort by</div>
              <div className="flex flex-wrap gap-1.5">
                {([['pri', 'Priority'], ['due', 'Due Date'], ['status', 'Status']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSortBy(k)}
                    className={`px-2.5 py-1 text-xs rounded-full border ${sortBy === k ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add — Tasks & Brain Dump */}
      {(activeView === 'inbox' || activeView === 'braindump') && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
          {activeView === 'braindump' ? (
            /* Brain Dump — multi-line textarea for pasting emails, notes, etc. */
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/50">
              <div className="flex items-start gap-2">
                <Brain size={16} className="text-amber-500 flex-shrink-0 mt-1" />
                <textarea
                  placeholder="Paste an email, jot a thought, dump a voice note... AI will parse it into a task"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  rows={3}
                  className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none resize-y min-h-[60px] max-h-[200px]"
                  disabled={addingTask}
                />
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-500">
                  {parseStatus || (newTaskText.trim().length > 30 ? 'AI will parse this into a structured task' : 'Short text will be added as-is')}
                </span>
                {newTaskText.trim() && (
                  <button
                    onClick={() => addTask(newTaskText, activeView)}
                    disabled={addingTask}
                    className="px-4 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {addingTask ? (
                      <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {parseStatus || 'Processing...'}</>
                    ) : (
                      <><Plus size={14} /> Add &amp; Parse</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Tasks — single line quick add */
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/50">
              <Plus size={16} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Quick-add a task..."
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTask(newTaskText, activeView); }}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
                disabled={addingTask}
              />
              {newTaskText.trim() && (
                <button
                  onClick={() => addTask(newTaskText, activeView)}
                  disabled={addingTask}
                  className="px-3 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {addingTask ? 'Adding...' : 'Add'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Task List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">

        {viewTasks.length === 0 ? (
          <EmptyViewState view={activeView} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-800 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <div className="col-span-1" />
                <div className="col-span-3">Task</div>
                <div className="col-span-1 text-center">Pri</div>
                <div className="col-span-1">Due</div>
                <div className="col-span-1">Owner</div>
                <div className="col-span-3">Next Action</div>
                <div className="col-span-1 text-center">Links</div>
                <div className="col-span-1 text-center">Status</div>
              </div>

              {filtered.map((t, i) => {
                const isExpanded = expandedId === t.id;
                const hasLinks = t.threadUrl || t.draftUrl || t.attachUrl;
                const airtableUrl = getAirtableUrl(t.airtableId);
                const linkCount = [t.threadUrl, t.draftUrl, t.attachUrl].filter(Boolean).length;

                return (
                  <div key={t.id} id={`task-${t.airtableId}`} className={`border-b border-gray-800/60 ${t.checked ? 'opacity-50' : ''}`}>
                    {/* Main row */}
                    <div
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-start transition-colors cursor-pointer
                        ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}
                        ${isExpanded ? 'bg-gray-800/60' : 'hover:bg-gray-800/50'}`}
                      onClick={() => { setShowStatusDropdown(false); setShowPriDropdown(false); toggleExpand(t.id); }}
                    >
                      <div className="col-span-1 flex items-center justify-center pt-0.5">
                        <button onClick={(e) => { e.stopPropagation(); toggleCheck(t.id); }} className="text-gray-600 hover:text-amber-400 transition-colors">
                          {t.checked ? <CheckSquare size={18} className="text-green-500" /> : <Square size={18} />}
                        </button>
                      </div>

                      <div className="col-span-3">
                        <span className={`text-sm font-medium ${t.checked ? 'line-through text-gray-600' : 'text-gray-100'}`}>
                          {t.task}
                        </span>
                        <div className="text-xs text-gray-600 mt-0.5">{t.project}</div>
                      </div>

                      <div className="col-span-1 flex justify-center pt-0.5">
                        <PriorityPill pri={t.pri} />
                      </div>

                      <div className="col-span-1">
                        <span className={`text-sm ${t.due && new Date(t.due) < new Date() ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                          {t.due}
                        </span>
                      </div>

                      <div className="col-span-1">
                        {(() => {
                          const owner = t.assignedTo || 'Chris';
                          const isMe = owner.toLowerCase().startsWith('chris');
                          return isMe ? (
                            <span className="text-sm text-gray-500 truncate block">Chris</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40 truncate" title={owner}>
                              <UserPlus size={10} className="shrink-0" />
                              {owner.split(' ')[0]}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="col-span-3">
                        <p className="text-sm text-gray-400 leading-snug line-clamp-2">{t.nextAction}</p>
                      </div>

                      <div className="col-span-1 flex items-center justify-center gap-1.5 pt-0.5">
                        {linkCount > 0 && (
                          <span className="text-xs text-gray-500">{linkCount}</span>
                        )}
                        <LinkIcon url={t.threadUrl} icon={ExternalLink} color="text-blue-400" title="Thread" />
                        <LinkIcon url={t.draftUrl} icon={FileText} color="text-green-400" title="Draft" />
                        <LinkIcon url={t.attachUrl} icon={Paperclip} color="text-purple-400" title="Attachment" />
                      </div>

                      <div className="col-span-1 flex items-center justify-center gap-1 pt-0.5">
                        {activeView === 'braindump' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveToTasks(t); }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-md transition-colors"
                            title="Move to Tasks"
                          >
                            <ArrowRightCircle size={12} />
                            Tasks
                          </button>
                        ) : (
                          <StatusPill status={t.status} />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                          className="p-0.5 rounded hover:bg-gray-700/50 transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-600" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="bg-gray-800/40 border-t border-gray-700/50 px-4 py-4">
                        <div className="ml-12 space-y-3">
                          <div className="flex items-center justify-end gap-3">
                            {t.airtableId && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingAirtableId(t.airtableId!); }}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                              >
                                Edit task →
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                              className="text-xs text-gray-500 hover:text-gray-300 font-medium"
                            >
                              Close
                            </button>
                          </div>
                          {/* Owner */}
                          {t.assignedTo && !t.assignedTo.toLowerCase().startsWith('chris') && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                <UserPlus size={13} />
                                Owner: {t.assignedTo}
                              </span>
                            </div>
                          )}

                          {/* Next Action — full text */}
                          {t.nextAction && (
                            <div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Next Action</div>
                              <p className="text-sm text-gray-300 leading-relaxed">{t.nextAction}</p>
                            </div>
                          )}

                          {/* Notes */}
                          {t.notes && (
                            <div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
                                <StickyNote size={11} />
                                Notes
                              </div>
                              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line"
                                dangerouslySetInnerHTML={{
                                  __html: t.notes.replace(
                                    /(https?:\/\/[^\s]+)/g,
                                    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>'
                                  )
                                }}
                              />
                            </div>
                          )}

                          {/* Link pills + Move to Tasks */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <LinkPill url={t.threadUrl} icon={Mail} label="Email Thread" color="text-blue-300" bgColor="bg-blue-950/60 border border-blue-800/40" />
                            <LinkPill url={t.draftUrl} icon={FileText} label="Draft" color="text-green-300" bgColor="bg-green-950/60 border border-green-800/40" />
                            <LinkPill
                              url={t.attachUrl}
                              icon={t.attachUrl?.includes('drafts') ? FileText : Paperclip}
                              label={t.attachUrl?.includes('drafts') ? 'Internal Draft' : t.attachUrl?.includes('docs.google.com') ? 'Google Doc' : 'Attachment'}
                              color="text-purple-300"
                              bgColor="bg-purple-950/60 border border-purple-800/40"
                            />
                            <LinkPill url={airtableUrl} icon={Table2} label="Open in Airtable" color="text-amber-300" bgColor="bg-amber-950/60 border border-amber-800/40" />
                            {activeView === 'braindump' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); moveToTasks(t); }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-md transition-colors"
                              >
                                <ArrowRightCircle size={12} />
                                Move to Tasks
                              </button>
                            )}
                          </div>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>From: {t.from}</span>
                            <span>Project: {t.project}</span>
                            {t.due && <span>Due: {t.due}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="px-4 py-12 text-center text-gray-600 text-sm">No tasks match your filters</div>
              )}
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {filtered.map(t => (
                <MobileTaskCard key={t.id} t={t} onToggle={toggleCheck} onExpand={toggleExpand} expanded={expandedId === t.id} onMove={activeView === 'braindump' ? moveToTasks : undefined} />
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-12 text-center text-gray-600 text-sm">No tasks match your filters</div>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-600 text-right">
              {filtered.length} of {viewTasks.length} tasks
            </div>
          </>
        )}
      </div>
      <TaskEditPanel
        taskId={editingAirtableId}
        onClose={() => setEditingAirtableId(null)}
        onSaved={() => { fetchTasks(); }}
      />
    </div>
  );
}
