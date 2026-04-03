type AdminPaginationProps = {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (nextOffset: number) => void;
};

export default function AdminPagination({ offset, limit, total, onOffsetChange }: AdminPaginationProps) {
  if (total <= 0) return null;
  const start = offset + 1;
  const end = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination__meta text-muted">
        {start}–{end} of {total}
      </span>
      <div className="admin-pagination__actions">
        <button type="button" className="btn-sm" disabled={!canPrev} onClick={() => onOffsetChange(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button type="button" className="btn-sm" disabled={!canNext} onClick={() => onOffsetChange(offset + limit)}>
          Next
        </button>
      </div>
    </div>
  );
}
