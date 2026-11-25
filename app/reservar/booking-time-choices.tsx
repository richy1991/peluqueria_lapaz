import { Button } from "@/components/ui";

type SlotChoice = { starts_at: string; time: string; is_available: boolean };

type BookingTimeChoicesProps = {
  times: SlotChoice[];
  value: string;
  onChange: (time: string) => void;
};

export function BookingTimeChoices({ times, value, onChange }: BookingTimeChoicesProps) {
  const availableCount = times.filter((slot) => slot.is_available).length;
  const occupiedCount = times.length - availableCount;

  return (
    <div className="booking-time-choices">
      <p className="booking-time-legend" aria-live="polite">
        <strong>{availableCount} disponibles</strong>
        {occupiedCount > 0 && <span>{occupiedCount} ocupados</span>}
      </p>
      <div className="booking-time-grid" role="group" aria-label="Horarios de inicio de la cita">
        {times.map((slot) => (
          <Button
            variant="unstyled"
            key={slot.starts_at}
            className="booking-time-slot"
            aria-pressed={value === slot.time}
            aria-label={`${slot.time}${slot.is_available ? ", disponible" : ", ocupado"}`}
            disabled={!slot.is_available}
            data-available={slot.is_available}
            onClick={() => onChange(slot.time)}
          >
            <span>{slot.time}</span>
            {!slot.is_available && <small>Ocupado</small>}
          </Button>
        ))}
      </div>
    </div>
  );
}
