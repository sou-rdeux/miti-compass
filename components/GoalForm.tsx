"use client";

// components/GoalForm.tsx
// 目的地（緯度・経度）の入力フォーム

import { useState } from "react";
import type { FormEvent } from "react";

export interface GoalFormProps {
  /** 入力値が検証OKだった場合にのみ呼ばれる */
  onSubmit: (destination: { lat: number; lng: number }) => void;
  /** 権限確認が完了していない間はtrue（操作不可） */
  disabled: boolean;
}

export default function GoalForm({ onSubmit, disabled }: GoalFormProps) {
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const lat = Number(latText);
    const lng = Number(lngText);

    // 共通：数値変換エラー（空、全角数字等の非対応文字含む）
    if (latText.trim() === "" || lngText.trim() === "" || Number.isNaN(lat) || Number.isNaN(lng)) {
      setErrorMessage("緯度・経度は数値で入力してください。");
      return;
    }

    if (lat < -90 || lat > 90) {
      setErrorMessage("緯度は -90〜90 の範囲で入力してください。");
      return;
    }

    if (lng < -180 || lng > 180) {
      setErrorMessage("経度は -180〜180 の範囲で入力してください。");
      return;
    }

    setErrorMessage(null);
    onSubmit({ lat, lng });
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="goal-lat" className="text-sm font-medium">
          緯度
        </label>
        <input
          id="goal-lat"
          type="text"
          inputMode="decimal"
          value={latText}
          disabled={disabled}
          onChange={(e) => setLatText(e.target.value)}
          className="w-full rounded border border-black px-3 py-2 text-lg disabled:opacity-50"
          placeholder="例：35.6895"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="goal-lng" className="text-sm font-medium">
          経度
        </label>
        <input
          id="goal-lng"
          type="text"
          inputMode="decimal"
          value={lngText}
          disabled={disabled}
          onChange={(e) => setLngText(e.target.value)}
          className="w-full rounded border border-black px-3 py-2 text-lg disabled:opacity-50"
          placeholder="例：139.6917"
        />
      </div>
      {errorMessage !== null && (
        <p className="text-sm font-bold text-red-600">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded bg-black px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
      >
        目的地設定
      </button>
    </form>
  );
}
