import { School } from "lucide-react";
import { buildingName, floorHas, searchDepartments, type CampusData, type RoomQuery } from "../lib/campus";
import { useLang } from "../lib/i18n";

interface Props {
  data: CampusData;
  query: string;
  room: RoomQuery | null;
  onShowCampus: () => void;
}

// 검색어가 강의실('테크노관 213', 'E5-213')이나 학과 이름이면 건물과 층을 바로 알려준다.
export function RoomFinder({ data, query, room, onShowCampus }: Props) {
  const { t } = useLang();
  const departments = room ? [] : searchDepartments(query, data);
  if (!room && !departments.length) return null;

  const floorNames = room?.floor
    ? (data.floors?.buildings[room.code]?.floors.filter(([f]) => floorHas(f, room.floor!)).flatMap(([, names]) => names) ?? [])
    : [];

  return (
    <section className="roomCard glass" aria-labelledby="roomTitle">
      <h2 id="roomTitle">
        <School size={16} aria-hidden="true" />{" "}
        {room
          ? t.roomResult(`${room.code} ${buildingName(data, room.code)}`, room.floor ? t.floorN(room.floor) : "")
          : t.deptResult}
      </h2>
      {room?.floor && floorNames.length > 0 && (
        <p className="hint" lang="ko">
          {floorNames.join(", ")}
        </p>
      )}
      {departments.length > 0 && (
        <ul className="floorList">
          {departments.map((d) => (
            <li key={`${d.code}-${d.floor}-${d.name}`}>
              <b>
                {d.code} {t.floorN(d.floor)}
              </b>
              <span lang="ko">
                {d.name} · {d.building}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="button small" onClick={onShowCampus}>
        {t.showOnCampus}
      </button>
    </section>
  );
}
