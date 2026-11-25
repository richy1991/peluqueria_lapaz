import { useState } from "react";
import { Sun, Sunset } from "lucide-react";
import { Button } from "@/components/ui";

type BookingTimeChoicesProps = {
  times: string[];
  afternoonStart: string;
  value: string;
  onChange: (time: string) => void;
};

export function BookingTimeChoices({ times, afternoonStart, value, onChange }: BookingTimeChoicesProps) {
  const morning = times.filter((time) => time < afternoonStart);
  const afternoon = times.filter((time) => time >= afternoonStart);
  const [preferAfternoon, setPreferAfternoon] = useState(value ? value >= afternoonStart : !morning.length);
  const showAfternoon = afternoon.length > 0 && (preferAfternoon || morning.length === 0);
  const shownTimes = showAfternoon ? afternoon : morning;

  return (
    <div className="booking-time-choices">
      <div className="booking-time-periods" role="group" aria-label="Momento del día">
        <Button variant="unstyled" aria-pressed={!showAfternoon} disabled={!morning.length} onClick={() => setPreferAfternoon(false)}>
          <Sun size={15} aria-hidden="true" /> Mañana <span className="booking-period-count" aria-hidden="true">{morning.length}</span>
        </Button>
        <Button variant="unstyled" aria-pressed={showAfternoon} disabled={!afternoon.length} onClick={() => setPreferAfternoon(true)}>
          <Sunset size={15} aria-hidden="true" /> Tarde <span className="booking-period-count" aria-hidden="true">{afternoon.length}</span>
        </Button>
      </div>

      <div key={String(showAfternoon)} className="booking-time-grid booking-schedule-enter" role="group" aria-label={showAfternoon ? "Horas de la tarde" : "Horas de la mañana"}>
        {shownTimes.map((time) => (
          <Button variant="unstyled" key={time} aria-pressed={value === time} onClick={() => onChange(time)}>{time}</Button>
        ))}
      </div>
    </div>
  );
}
