import React, { useMemo } from "react";
import { WebView } from "react-native-webview";
import { BASE_URL } from "./api";
import { invitationRenderer, invitationCss } from "./invitationSource";

export function InvitationPreview({ data }: { data: Record<string, unknown> }) {
  const html = useMemo(() => {
    const payload = JSON.stringify(data).replace(/</g, "\\u003c");
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Tajawal:wght@400;500;600;700&display=swap"><style>${invitationCss}</style><style>html,body{margin:0;padding:0;background:#2E0D1B}.invite-canvas{height:620px;border-radius:18px}audio{width:100%;margin-top:10px}</style></head><body><div id="preview"></div><script>${invitationRenderer}\nconst data=${payload};document.getElementById('preview').innerHTML=window.NOORTOONA.canvas(data);const audio=window.NOORTOONA.safeAudioUrl(data.design.audio);if(audio){const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=audio;document.body.appendChild(player);}</script></body></html>`;
  }, [data]);
  return <WebView
    source={{ html, baseUrl: `${BASE_URL}/` }}
    style={{ height: data.design && (data.design as { audio?: string }).audio ? 685 : 625, backgroundColor: "transparent" }}
    scrollEnabled={false}
    originWhitelist={["*"]}
    onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url === `${BASE_URL}/`}
    javaScriptCanOpenWindowsAutomatically={false}
    setSupportMultipleWindows={false}
    allowFileAccess={false}
    geolocationEnabled={false}
    mediaPlaybackRequiresUserAction
    accessibilityLabel="معاينة الدعوة بنفس تصميم الضيف"
  />;
}
