import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

/**
 * Honest placeholder for modules whose full UI lands in later phases.
 * Rendered only behind the proper permission so navigation stays clean.
 */
export default function ModulePlaceholder({ title, subtitle, emptyTitle, emptyMessage, phase = '' }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title={emptyTitle ?? `No ${title.toLowerCase()} yet`}
        message={
          emptyMessage ??
          `This module ships with its full workflow in a later phase${phase ? ` (${phase})` : ''}. No data yet.`
        }
      />
    </div>
  );
}
