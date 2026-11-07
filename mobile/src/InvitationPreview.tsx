import React, { useMemo, useState } from "react";
import { WebView } from "react-native-webview";
import { BASE_URL } from "./api";
import { invitationRenderer, invitationCss } from "./invitationSource";

export function InvitationPreview({ data }: { data: Record<string, unknown> }) {
  const [height,setHeight]=useState(700);
  const html = useMemo(() => {
    const payload = JSON.stringify(data).replace(/</g, "\\u003c");
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${invitationCss}</style><style>html,body{margin:0;padding:0;background:#0A0D13}.invite-canvas{height:620px;border-radius:18px}audio{width:100%;margin-top:10px}</style></head><body><div id="preview"></div><script>${invitationRenderer}\nconst data=${payload};document.getElementById('preview').innerHTML=window.NOORTOONA.canvas(data);const audio=window.NOORTOONA.safeAudioUrl(data.design.audio);if(audio){const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=audio;document.body.appendChild(player);}const report=()=>window.ReactNativeWebView?.postMessage(JSON.stringify({height:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)}));new ResizeObserver(report).observe(document.body);document.fonts.ready.then(report);report();</script></body></html>`;
  }, [data]);
  return <WebView
    source={{ html, baseUrl: `${BASE_URL}/` }}
    style={{ height, backgroundColor: "transparent" }}
    onMessage={event=>{try{const value=Number(JSON.parse(event.nativeEvent.data).height);if(Number.isFinite(value)&&value>=300&&value<=5000)setHeight(Math.ceil(value))}catch{}}}
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
