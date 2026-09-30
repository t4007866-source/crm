"use client";
import { useState, useEffect } from "react";

export default function PipelinePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted)" }}>
        טוען...
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pipeline מכירות</h1>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {data.pipeline.map((col: any) => (
          <div key={col.stage} className="flex-shrink-0 w-72">
            <div className="card">
              <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="font-medium text-sm">{col.stage}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {col.deals.length} עסקאות • ₪{col.totalValue.toLocaleString()}
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[100px]">
                {col.deals.length === 0 ? (
                  <div className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>
                    אין עסקאות
                  </div>
                ) : (
                  col.deals.map((d: any) => (
                    <div key={d.id} className="card p-3 text-sm">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {d.customer?.name}
                      </div>
                      <div className="font-mono mt-1" style={{ color: "var(--rust)" }}>
                        ₪{d.value.toLocaleString()}
                      </div>
                      <div className="text-xs mt-1">סיכוי: {d.probability}%</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

