import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function FloatingMessenger() {
    const location = useLocation();

    // 현재 접속한 사용자 정보 가져오기
    const currentUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId') || '';
    const currentUserName = sessionStorage.getItem('userName') || localStorage.getItem('userName') || currentUserId;
    const userRole = sessionStorage.getItem('role') || localStorage.getItem('role') || 'GENERAL';

    const excludedPaths = ['/tv', '/self-checkin', '/kiosk', '/guest', '/mobile-checkin', '/m'];
    const isExcluded = excludedPaths.some(path => location.pathname.toLowerCase() === path || location.pathname.toLowerCase().startsWith(path + '/'));

    const [isMessengerOpen, setIsMessengerOpen] = useState(false);
    const [chatRoom, setChatRoom] = useState('HOTEL');
    const [messages, setMessages] = useState(() => {
        const saved = JSON.parse(localStorage.getItem('hr_group_messages'));
        if (saved && Array.isArray(saved.HOTEL)) return saved;
        return { HOTEL: [], TEAM: [] };
    });
    const [newMessage, setNewMessage] = useState('');
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    // 💡 [신규] 현재 답장 중인 메시지 정보를 담는 상태
    const [replyingTo, setReplyingTo] = useState(null);

    const [lastReadHotel, setLastReadHotel] = useState(() => Number(localStorage.getItem(`msg_read_hotel_${currentUserId}`)) || 0);
    const [lastReadTeam, setLastReadTeam] = useState(() => Number(localStorage.getItem(`msg_read_team_${currentUserId}`)) || 0);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const audioRef = useRef(null);

    // 새 메시지가 오면 맨 아래로 자동 스크롤
    useEffect(() => {
        if (isMessengerOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isMessengerOpen, chatRoom]);

    useEffect(() => {
        const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';
        audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

        const handleStorageChange = (e) => {
            if (e.key === 'hr_group_messages') {
                const saved = JSON.parse(e.newValue);
                if (saved) setMessages(saved);
            }
        };
        window.addEventListener('storage', handleStorageChange);

        if (currentHotelCode) {
            const socketUrl = import.meta.env.VITE_API_URL || 'https://api.hotelnplus.com';
            socketRef.current = io(socketUrl, {
                transports: ['websocket', 'polling'],
                secure: true,
                rejectUnauthorized: false
            });

            socketRef.current.on('receive_chat', (data) => {
                if (data.hotel_code === currentHotelCode || data.hotel_code === 'ALL') {
                    setMessages(data.messages);
                    localStorage.setItem('hr_group_messages', JSON.stringify(data.messages));

                    const allNew = [...(data.messages.HOTEL || []), ...(data.messages.TEAM || [])];
                    const hasNewForeign = allNew.some(m => m.id > Math.max(lastReadHotel, lastReadTeam) && m.sender !== currentUserId);
                    if (hasNewForeign && audioRef.current) {
                        audioRef.current.play().catch(() => { });
                    }
                }
            });

            return () => {
                window.removeEventListener('storage', handleStorageChange);
                if (socketRef.current) socketRef.current.disconnect();
            };
        }
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [lastReadHotel, lastReadTeam, currentUserId]);

    useEffect(() => {
        if (isMessengerOpen) {
            const now = Date.now();
            if (chatRoom === 'HOTEL') {
                setLastReadHotel(now);
                localStorage.setItem(`msg_read_hotel_${currentUserId}`, now.toString());
            } else if (chatRoom === 'TEAM') {
                setLastReadTeam(now);
                localStorage.setItem(`msg_read_team_${currentUserId}`, now.toString());
            }
        }
    }, [isMessengerOpen, messages, chatRoom, currentUserId]);

    if (!currentUserId || isExcluded) return null;

    const hotelMessages = messages.HOTEL || [];
    const teamMessages = (messages.TEAM || []).filter(m => m.team === userRole);
    const currentMessages = chatRoom === 'HOTEL' ? hotelMessages : teamMessages;

    const unreadHotelCount = hotelMessages.filter(m => m.id > lastReadHotel && m.sender !== currentUserId).length;
    const unreadTeamCount = teamMessages.filter(m => m.id > lastReadTeam && m.sender !== currentUserId).length;
    const totalUnread = unreadHotelCount + unreadTeamCount;

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File is too large. Please select a file under 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const isPdf = file.type === 'application/pdf';
            sendMediaMessage(reader.result, isPdf ? 'pdf' : 'image', file.name);
        };
        reader.readAsDataURL(file);
        setShowAttachMenu(false);
        e.target.value = null;
    };

    // 💡 [수정] 미디어 전송 시 답장 정보 포함
    const sendMediaMessage = (base64Data, type, fileName) => {
        const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';

        const replyData = replyingTo ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName || replyingTo.sender,
            text: replyingTo.text || (replyingTo.mediaType ? `[${replyingTo.mediaType.toUpperCase()}]` : '')
        } : null;

        const msg = {
            id: Date.now(),
            sender: currentUserId,
            senderName: currentUserName,
            text: type === 'pdf' ? `📄 ${fileName}` : '',
            mediaUrl: base64Data,
            mediaType: type,
            fileName: fileName,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            team: userRole,
            replyTo: replyData
        };

        const updated = { ...messages, [chatRoom]: [...(messages[chatRoom] || []), msg] };
        setMessages(updated);
        localStorage.setItem('hr_group_messages', JSON.stringify(updated));
        setReplyingTo(null);

        if (socketRef.current) {
            socketRef.current.emit('broadcast_chat', { hotel_code: currentHotelCode, messages: updated });
        }
    };

    // 💡 [수정] 텍스트 전송 시 답장 정보 포함
    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        const currentHotelCode = sessionStorage.getItem('hotelCode') || localStorage.getItem('hotelCode') || '';

        const replyData = replyingTo ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName || replyingTo.sender,
            text: replyingTo.text || (replyingTo.mediaType ? `[${replyingTo.mediaType.toUpperCase()}]` : '')
        } : null;

        const msg = {
            id: Date.now(),
            sender: currentUserId,
            senderName: currentUserName,
            text: newMessage,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            team: userRole,
            replyTo: replyData
        };

        const updated = { ...messages, [chatRoom]: [...(messages[chatRoom] || []), msg] };
        setMessages(updated);
        localStorage.setItem('hr_group_messages', JSON.stringify(updated));
        setNewMessage('');
        setReplyingTo(null);

        if (socketRef.current) {
            socketRef.current.emit('broadcast_chat', { hotel_code: currentHotelCode, messages: updated });
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end animate-fade-in">
            {isMessengerOpen && (
                <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-[350px] md:w-[400px] mb-4 overflow-hidden flex flex-col h-[550px] max-h-[85vh]">
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0 shadow-sm z-10">
                        <div className="flex gap-4">
                            <button onClick={() => { setChatRoom('HOTEL'); setReplyingTo(null); }} className={`font-black text-sm tracking-wider relative transition-colors ${chatRoom === 'HOTEL' ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400 hover:text-slate-200'}`}>
                                HOTEL
                                {unreadHotelCount > 0 && <span className="absolute -top-1.5 -right-3 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full animate-pulse">{unreadHotelCount > 9 ? '9+' : unreadHotelCount}</span>}
                            </button>
                            <button onClick={() => { setChatRoom('TEAM'); setReplyingTo(null); }} className={`font-black text-sm tracking-wider relative transition-colors ${chatRoom === 'TEAM' ? 'text-white border-b-2 border-white pb-1' : 'text-slate-400 hover:text-slate-200'}`}>
                                MY TEAM
                                {unreadTeamCount > 0 && <span className="absolute -top-1.5 -right-3 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full animate-pulse">{unreadTeamCount > 9 ? '9+' : unreadTeamCount}</span>}
                            </button>
                        </div>
                        <button onClick={() => setIsMessengerOpen(false)} className="text-slate-400 hover:text-white font-black text-xl transition-colors">✕</button>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-5 flex flex-col" onClick={() => setShowAttachMenu(false)}>
                        {currentMessages.length === 0 ? (
                            <div className="m-auto text-center">
                                <span className="text-4xl mb-2 block opacity-20">💬</span>
                                <p className="text-slate-400 text-xs font-bold">No messages in {chatRoom === 'HOTEL' ? 'Our Hotel' : 'Our Team'} yet.</p>
                            </div>
                        ) : (
                            currentMessages.map(m => {
                                const isMine = m.sender === currentUserId;
                                return (
                                    // 💡 [수정] 말풍선 그룹에 hover 시 답장 버튼(↩️) 표시
                                    <div key={m.id} className={`flex flex-col relative group ${isMine ? 'items-end' : 'items-start'}`}>
                                        <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                {m.senderName && m.senderName !== m.sender ? `${m.senderName} (${m.sender})` : m.sender} · {m.time}
                                            </span>
                                            {/* 답장 버튼 (마우스 오버 시 표시) */}
                                            <button onClick={() => setReplyingTo(m)} className="text-[10px] text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                                                ↩️ Reply
                                            </button>
                                        </div>

                                        <div className={`px-3.5 py-2.5 rounded-md text-sm shadow-sm max-w-[85%] whitespace-pre-wrap break-words ${isMine ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}>

                                            {/* 💡 [신규] 원본 메시지(답장 대상) 인용 블록 렌더링 */}
                                            {m.replyTo && (
                                                <div className={`mb-2 p-2 rounded text-xs border-l-[3px] flex flex-col gap-0.5 shadow-inner 
                                                    ${isMine ? 'bg-blue-700/50 border-blue-300 text-blue-100' : 'bg-slate-100 border-slate-400 text-slate-600'}`}>
                                                    <span className="font-black truncate">{m.replyTo.senderName}</span>
                                                    <span className="truncate opacity-90">{m.replyTo.text}</span>
                                                </div>
                                            )}

                                            {m.text && <div>{m.text}</div>}

                                            {/* 미디어 렌더링 영역 */}
                                            {m.mediaType === 'image' && (
                                                <img src={m.mediaUrl} alt="attachment" className="mt-2 rounded-md max-w-full h-auto cursor-zoom-in border border-black/10 hover:opacity-90" onClick={() => window.open(m.mediaUrl, '_blank')} />
                                            )}
                                            {m.mediaType === 'pdf' && (
                                                <a href={m.mediaUrl} download={m.fileName} className="mt-1 flex items-center gap-2 bg-black/10 p-2 rounded border border-white/20 hover:bg-black/20 transition-colors cursor-pointer text-xs font-bold no-underline">
                                                    <span className="text-lg">📄</span> Download PDF
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 숨겨진 파일 및 카메라 인풋 */}
                    <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileUpload} />

                    {/* 입력창 및 기능 영역 */}
                    <div className="bg-white flex flex-col shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">

                        {/* 💡 [신규] 내가 어떤 메시지에 답장 중인지 보여주는 미리보기 박스 */}
                        {replyingTo && (
                            <div className="bg-slate-100 border-l-4 border-blue-500 p-2.5 mx-3 mt-3 rounded-r-md flex justify-between items-center shadow-sm">
                                <div className="min-w-0 flex-1 pr-2">
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wide">Replying to {replyingTo.senderName}</div>
                                    <div className="text-xs text-slate-600 truncate mt-0.5">
                                        {replyingTo.text || (replyingTo.mediaType ? `[${replyingTo.mediaType.toUpperCase()}]` : '')}
                                    </div>
                                </div>
                                <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 w-6 h-6 flex items-center justify-center bg-white rounded-full shadow-sm font-bold transition-colors shrink-0">✕</button>
                            </div>
                        )}

                        <div className="p-3 flex gap-2 items-center relative">
                            <button onClick={() => setShowAttachMenu(!showAttachMenu)} className={`text-slate-400 hover:text-blue-600 p-2 rounded-full transition-colors ${showAttachMenu ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            </button>

                            {/* 첨부파일 팝업 메뉴 */}
                            {showAttachMenu && (
                                <div className="absolute bottom-16 left-2 bg-white border border-slate-200 shadow-xl rounded-lg p-2 flex flex-col gap-1 w-40 z-50 animate-fade-in">
                                    <button onClick={() => { cameraInputRef.current.click(); setShowAttachMenu(false); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-md transition-colors text-left">
                                        <span>📸</span> Take Photo
                                    </button>
                                    <button onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-md transition-colors text-left">
                                        <span>🖼️</span> File / Gallery
                                    </button>
                                </div>
                            )}

                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                onFocus={() => setShowAttachMenu(false)}
                                placeholder="Type a message..."
                                className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-md transition-transform active:scale-95 flex items-center justify-center shrink-0 w-10 h-10">
                                <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => setIsMessengerOpen(!isMessengerOpen)} className={`relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-transform hover:scale-105 active:scale-95 ${isMessengerOpen ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white'}`}>
                {isMessengerOpen ? '✕' : '💬'}

                {/* 💡 닫혀있을 때 총 안읽은 개수 표시 (1~99+) */}
                {!isMessengerOpen && totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[11px] font-black min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full border-2 border-white shadow-md animate-bounce">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>
        </div>
    );
}