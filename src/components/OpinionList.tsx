import type { PublishedOpinion } from "../schemas/opinion";

type OpinionListProps = { opinions: PublishedOpinion[] };

export default function OpinionList({ opinions }: OpinionListProps) {
  return (
    <section className="opinion-list" aria-labelledby="opinion-list-title">
      <h3 id="opinion-list-title">승인된 팁·의견</h3>
      {opinions.length === 0 ? <p>아직 승인된 의견이 없습니다.</p> : (
        <ul>
          {opinions.map((opinion) => (
            <li key={opinion.id}>
              <strong>{opinion.nickname}</strong>
              <p>{opinion.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
