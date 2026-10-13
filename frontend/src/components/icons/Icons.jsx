import React from 'react';

export function SvgDefinitions() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs dangerouslySetInnerHTML={{ __html: `
<symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7v9H4z"></path><path d="M10 20v-6h4v6"></path></symbol>
<symbol id="i-mega" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"></path><path d="M17 9a4 4 0 0 1 0 6"></path></symbol>
<symbol id="i-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z"></path></symbol>
<symbol id="i-smile" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"></path></symbol>
<symbol id="i-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path></symbol>
<symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"></path><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .7 3.5 2.4 3.5 5.3"></path></symbol>
<symbol id="i-plug" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"></path></symbol>
<symbol id="i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h8l8 8-8 8-8-8z"></path><circle cx="8.5" cy="8.5" r="1"></circle></symbol>
<symbol id="i-trend" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"></path></symbol>
<symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path></symbol>
<symbol id="i-swap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"></path></symbol>
<symbol id="i-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"></path></symbol>
<symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></symbol>
<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></symbol>
<symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"></path></symbol>
<symbol id="i-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"></path></symbol>
<symbol id="i-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"></path></symbol>
<symbol id="i-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"></path></symbol>
<symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></symbol>
<symbol id="i-filter" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6 8v5l-4 2v-7z"></path></symbol>
<symbol id="i-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M10 21h4"></path></symbol>
<symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M9 3v4M15 3v4"></path></symbol>
<symbol id="i-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"></path></symbol>
<symbol id="i-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"></path></symbol>
<symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l9 16H3z"></path><path d="M12 10v4M12 17h.01"></path></symbol>
<symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></symbol>
<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"></path><path d="M8.5 12l2.5 2.5 4.5-5"></path></symbol>
<symbol id="i-more" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"></path></symbol>
<symbol id="i-scan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"></path></symbol>
<symbol id="i-brief" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"></path></symbol>
<symbol id="i-film" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"></path></symbol>
<symbol id="i-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"></path></symbol>
<symbol id="i-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"></path></symbol>
<symbol id="i-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"></path></symbol>
<symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></symbol>
<symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"></path></symbol>
<symbol id="i-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"></path></symbol>
<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></symbol>
<symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></symbol>
<symbol id="i-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l5 5v13H6z"></path><path d="M14 3v5h5M9 13h7M9 17h7"></path></symbol>
<symbol id="i-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M21 16l-5-5-9 9"></path></symbol>
<symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-2-7z"></path></symbol>
<symbol id="i-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></symbol>
<symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path></symbol>
<symbol id="i-board" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="5" height="16" rx="1"></rect><rect x="10" y="4" width="5" height="10" rx="1"></rect><rect x="17" y="4" width="4" height="13" rx="1"></rect></symbol>
<symbol id="i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></symbol>
<symbol id="i-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"></path></symbol>
<symbol id="i-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l13 8-13 8z"></path></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></symbol>
<symbol id="i-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle></symbol>
<symbol id="i-bulb" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"></path></symbol>
<symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V4H4v12h4"></path></symbol>
<symbol id="i-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"></path></symbol>
<symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></symbol>
<symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"></path></symbol>
<symbol id="i-grip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"></path></symbol>
<symbol id="i-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"></path></symbol>
<symbol id="logo-mark" viewBox="0 0 48 48"><path d="M24 4.5L40 10.5V23c0 9.6-6.6 16.4-16 20.5C14.6 39.4 8 32.6 8 23V10.5z" fill="var(--logo-ring,#0F5C54)" stroke="var(--logo-ring,#0F5C54)" strokeWidth="2" strokeLinejoin="round"></path><rect x="21.4" y="22" width="5.2" height="13" rx="2.6" fill="var(--logo-stem,#FFFFFF)"></rect><circle cx="24" cy="15.6" r="3.4" fill="var(--logo-drop,#5FD3C2)"></circle></symbol>
` }} />
    </svg>
  );
}

export function Icon({ name, size = 18, width, height, className = '', style = {}, ...props }) {
  const href = name.startsWith('#') ? name : '#' + name;
  return (
    <svg
      width={width || size}
      height={height || size}
      className={className}
      style={{ flex: 'none', ...style }}
      {...props}
    >
      <use href={href} />
    </svg>
  );
}

export default Icon;
