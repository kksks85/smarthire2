import { useEffect, useState } from "react";
import api from "../../api/client";
import { PageHead } from "../../components/ui";

interface Question {
  id: number;
  text: string;
  category?: string | null;
  order_index: number;
  is_active: boolean;
}

export default function Screening() {
  const [items, setItems] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("General");

  const load = () =>
    api.get<Question[]>("/screening-questions").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!text.trim()) return;
    await api.post("/screening-questions", {
      text,
      category,
      order_index: items.length + 1,
    });
    setText("");
    load();
  }

  return (
    <div>
      <PageHead
        title="Screening Questions"
        breadcrumb="Administration › Screening Questions"
      />
      <div className="inline-note">
        These pre-configured questions drive the Screening stage of the interview pipeline.
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">Add Question</div>
        <div className="card-body">
          <div className="field">
            <label>Question</label>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="btn-row" style={{ alignItems: "center", marginTop: 8 }}>
            <input
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <button className="btn primary" onClick={add}>
              Add
            </button>
          </div>
        </div>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Question</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {items.map((q) => (
            <tr key={q.id}>
              <td>{q.order_index}</td>
              <td>{q.text}</td>
              <td>{q.category ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
