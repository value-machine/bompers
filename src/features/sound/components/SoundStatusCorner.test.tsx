import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundStatusCorner } from "@/features/sound/components/SoundStatusCorner";
import type { SoundStatus } from "@/features/sound/types/sound.types";

const status = vi.hoisted(() => ({ value: null as SoundStatus | null }));
const toggleMute = vi.hoisted(() => vi.fn());
vi.mock("@/features/sound/hooks/useAudioEngine", () => ({
  useAudioEngine: () => ({ toggleMute }),
  useSoundStatus: () => status.value,
}));

describe("SoundStatusCorner", () => {
  it("should show nothing when the sound plays", () => {
    status.value = null;
    render(<SoundStatusCorner placement="top-right" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should show the tap-for-sound chip when a gamepad press could not start the sound", () => {
    status.value = "blocked";
    render(<SoundStatusCorner placement="bottom-right" />);
    expect(screen.getByRole("status")).toHaveTextContent("Tap for sound");
  });

  it("should show a sound-off button that unmutes when the player muted with M", () => {
    status.value = "muted";
    render(<SoundStatusCorner placement="top-right" />);

    const chip = screen.getByRole("button", { name: /turn sound on/i });
    expect(chip).toHaveTextContent("Sound off");
    expect(chip).toHaveTextContent("M");
    fireEvent.click(chip);

    expect(toggleMute).toHaveBeenCalledTimes(1);
  });
});
