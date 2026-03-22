/**
 * Skeleton loading components for portal pages
 * Follows design system from CLAUDE.md
 * Colors: bg-gray-800/30 (nested elements), border-gray-700 (secondary borders)
 *
 * UNIFIED APPROACH: All skeletons use consistent styling for professional appearance
 */

interface SkeletonProps {
  count?: number;
}

/**
 * UNIVERSAL SKELETON - Use this everywhere for consistent loading experience
 * Simple list-based skeleton that works for all portal contexts
 * Matches the execution list design for uniformity
 */
export function UnifiedSkeleton({ count = 5 }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 bg-gray-700/50 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-700/50 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-gray-700/50 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * PORTAL ALL VIEW SKELETON - Matches the main portal "All" view structure
 * Shows filter bar, metrics cards, and execution list container
 */
export function PortalAllViewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter Bar Skeleton */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-32 bg-gray-700/50 rounded-lg animate-pulse" />
            <div className="h-7 w-32 bg-gray-700/50 rounded-lg animate-pulse" />
            <div className="h-7 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 bg-gray-700/50 rounded-lg animate-pulse" />
            <div className="h-7 w-8 bg-gray-700/50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Metrics Cards Skeleton - 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 w-4 bg-gray-700/50 rounded animate-pulse" />
              <div className="h-3 w-12 bg-gray-700/50 rounded animate-pulse" />
            </div>
            <div className="h-6 w-12 bg-gray-700/50 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Executions Container Skeleton */}
      <div className="bg-gray-900/30 border border-gray-800/50 rounded-2xl overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 p-2 bg-gray-900/50 border-b border-gray-800">
          <div className="h-7 w-20 bg-gray-700/50 rounded-lg animate-pulse" />
          <div className="h-7 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
          <div className="h-7 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
        </div>

        {/* Execution List */}
        <div className="p-3">
          <UnifiedSkeleton count={5} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for execution metrics cards (4-card grid)
 * Matches the metrics section at top of portal pages
 * Responsive: 2 columns on mobile, 4 on desktop
 */
export function MetricsCardSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-3"
        >
          {/* Icon + label */}
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-4 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-3 w-12 bg-gray-800/30 rounded animate-pulse" />
          </div>
          {/* Metric value */}
          <div className="h-6 w-16 bg-gray-800/30 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for workflow list items
 * Matches WorkflowList component structure with header, badges, and toggle
 */
export function WorkflowListSkeleton({ count = 3 }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-4"
        >
          {/* Header row: workflow name + toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-48 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-800/30 rounded-full animate-pulse" />
          </div>

          {/* Badges row: credentials and status */}
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gray-800/30 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for execution list (table-style rows)
 * Matches execution history table layout
 * Use with standalone set to true for independent usage, false for inline usage
 */
export function ExecutionListSkeleton({ count = 5, standalone = true }: SkeletonProps & { standalone?: boolean }) {
  const rows = Array.from({ length: count }).map((_, i) => (
    <div key={i} className="p-4 bg-gray-800/30 rounded-xl space-y-2">
      {/* Left side: workflow name + timestamp */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-40 bg-gray-700/50 rounded animate-pulse" />
          <div className="h-3 w-32 bg-gray-700/50 rounded animate-pulse" />
        </div>
        {/* Right side: status badge */}
        <div className="h-6 w-16 bg-gray-700/50 rounded-full animate-pulse" />
      </div>
    </div>
  ));

  if (standalone) {
    return (
      <div className="bg-gray-900/30 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="divide-y divide-gray-800 p-4 space-y-2">
          {rows}
        </div>
      </div>
    );
  }

  return <div className="space-y-2">{rows}</div>;
}

/**
 * Generic card skeleton for grid layouts
 * Reusable for panels view, instance cards, etc.
 * Responsive: 1 column mobile, 2 tablet, 3 desktop
 */
export function GenericCardSkeleton({ count = 4 }: SkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6"
        >
          {/* Card title */}
          <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse mb-4" />

          {/* Card content: 2 rows of text */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-800/30 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-800/30 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * STANDARDIZED: Card grid skeleton for Templates, Credentials, Workflows, UI Embeds
 * Consistent design with icon + title + description layout
 * Grid: 1 col mobile, 2 tablet, 3 desktop
 */
export function CardGridSkeleton({ count = 6 }: SkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            {/* Icon skeleton */}
            <div className="w-10 h-10 rounded-xl bg-gray-700/50 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {/* Title skeleton */}
              <div className="h-5 w-3/4 bg-gray-700/50 rounded animate-pulse mb-2" />
              {/* Subtitle skeleton */}
              <div className="h-4 w-1/2 bg-gray-700/50 rounded animate-pulse" />
            </div>
          </div>
          {/* Description lines */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-700/50 rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-gray-700/50 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * CHAT PAGE SKELETON - Mimics the chat layout with sidebar + main chat area
 * Used for chat/[id] page loading, dynamic import fallback, and suspense
 */
export function ChatSkeleton() {
  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-72 flex-col border-r border-gray-800 p-4 space-y-4">
        {/* New chat button */}
        <div className="h-10 w-full bg-gray-700/50 rounded-lg animate-pulse" />
        {/* Conversation items */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 w-full bg-gray-800/30 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-3">
          <div className="h-5 w-32 bg-gray-700/50 rounded animate-pulse" />
          <div className="ml-auto h-8 w-8 bg-gray-800/30 rounded-lg animate-pulse" />
        </div>

        {/* Messages area */}
        <div className="flex-1 p-6 space-y-6 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className={`space-y-2 ${i % 2 === 0 ? 'max-w-[60%]' : 'max-w-[70%]'}`}>
                <div className="h-4 w-full bg-gray-800/30 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-800/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-800">
          <div className="h-12 w-full bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * PARTNERS PAGE SKELETON - Mimics the partners layout with sidebar + table
 * Header + category sidebar + table rows
 */
export function PartnersSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pb-24 lg:pb-20">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="h-10 w-48 bg-gray-700/50 rounded animate-pulse mx-auto mb-4" />
        <div className="h-5 w-80 bg-gray-700/50 rounded animate-pulse mx-auto" />
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar categories - desktop */}
          <div className="hidden lg:block lg:w-52 flex-shrink-0">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="h-4 w-24 bg-gray-700/50 rounded animate-pulse mb-4" />
              <div className="space-y-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-9 w-full bg-gray-800/30 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="border-b border-gray-800 bg-gray-800/30 px-3 py-3 flex gap-4">
                {['w-20', 'w-32', 'w-24', 'w-28', 'w-24', 'w-28'].map((w, i) => (
                  <div key={i} className={`h-4 ${w} bg-gray-700/50 rounded animate-pulse`} />
                ))}
              </div>
              {/* Table rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-b border-gray-800/50 px-3 py-3 flex items-center gap-4">
                  {/* Partner logo + name */}
                  <div className="flex items-center gap-3 w-40">
                    <div className="w-16 h-16 rounded-lg bg-gray-800/50 animate-pulse flex-shrink-0" />
                    <div className="h-4 w-16 bg-gray-700/50 rounded animate-pulse" />
                  </div>
                  {/* Description */}
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-full bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                  {/* Offer columns */}
                  <div className="h-4 w-20 bg-gray-800/30 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-800/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TEMPLATES PAGE SKELETON - Mimics the n8n-templates page
 * Header with actions + search bar + card grid
 */
export function TemplatesSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="h-7 w-48 bg-gray-700/50 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-800/30 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-gray-800/50 border border-gray-700 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-gray-800/50 border border-gray-700 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="h-11 w-full max-w-md bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
      </div>

      {/* Card grid */}
      <CardGridSkeleton count={6} />
    </div>
  );
}

/**
 * UI STUDIO PAGE SKELETON - Mimics the UI studio gallery view
 * Header with filter tabs + search + card grid
 */
export function UIStudioSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="h-8 w-40 bg-gray-700/50 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-800/30 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 bg-gray-800/50 border border-gray-800 rounded-lg animate-pulse" />
          <div className="h-9 w-16 bg-gray-800/50 border border-gray-800 rounded-lg animate-pulse" />
          <div className="h-9 w-16 bg-gray-700/50 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-9 ${i === 0 ? 'w-16' : 'w-24'} bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse`} />
        ))}
      </div>

      {/* Card grid */}
      <CardGridSkeleton count={6} />
    </div>
  );
}

/**
 * STANDARDIZED: Two-column section skeleton for Payment and Settings tabs
 * Left column: Smaller info cards
 * Right column: Main content area
 */
export function TwoColumnSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="h-6 w-32 bg-gray-700/50 rounded animate-pulse mb-4" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-700/50 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-700/50 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="h-6 w-40 bg-gray-700/50 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" />
                <div className="h-10 flex-1 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
