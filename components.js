// =========================================================
// 1. CONFIG & UTILITIES
// =========================================================

const API_BASE = 'แก้เป็นลิงก์ Back-end'; 

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function getProfileImageUrl(path) {
    if (!path) return 'https://placehold.co/100?text=User';
    return path.startsWith('http') ? path : `${API_BASE}/uploads/${path}`;
}

// เพิ่มฟังก์ชันกลางไว้ในส่วน Config (ส่วนที่ 1)
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    // ✅ เพิ่มเช็ค: ถ้าไม่ใช่ FormData ให้ใส่ Content-Type เป็น JSON
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });

    // ถ้า Server ตอบกลับมาว่า 401 (ซึ่งเราแก้ Middleware ใน server.js ไว้แล้ว)
    if (response.status === 401) {
        const data = await response.json();
        if (data.forceLogout) {
            localStorage.clear();
            window.location.href = 'login.html?reason=session_expired';
            return;
        }
    }
    return response;
}

async function logout() {
    const user = getUser(); 
    const token = localStorage.getItem('token');

    // 1. ส่งสัญญาณบอก Server (ถ้ามีข้อมูลครบ)
    if (user && user.UserID && token) {
        try {
            // แนะนำให้ใช้ fetch ปกติที่นี่ (ไม่ใช่ apiRequest) 
            // เพราะเรากำลังจะเคลียร์ทิ้งอยู่แล้ว ไม่ต้องดัก 401 ซ้อน
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId: user.UserID })
            });
        } catch (err) {
            console.error("Logout API Error:", err);
        }
    }

    // 2. [สำคัญ] ล้างค่าในเครื่องให้เกลี้ยง
    localStorage.clear();
    sessionStorage.clear(); // ล้าง session เผื่อมีการเก็บค่าชั่วคราวไว้

    // 3. [อัปเกรด] ตัดกุญแจ Socket ทันที
    if (window.socket) {
        console.log("🔌 Disconnecting socket...");
        window.socket.disconnect();
        window.socket = null;
    }

    // 4. พาไปหน้า Login
    // แนะนำให้เพิ่ม query string เพื่อแจ้งผู้ใช้ (Optional)
    window.location.href = 'login.html?logout=success';
}

// =========================================================
// 2. WEB COMPONENTS
// =========================================================

// --- App Header ---
class AppHeader extends HTMLElement {
    connectedCallback() {
        const user = getUser(); // ดึงข้อมูลผู้ใช้จาก localStorage
        if (!user) return;

        const isHead = user.RoleID === 1;
        // ตรวจสอบว่าเป็น iPad แนวนอนหรือไม่ เพื่อปรับขนาด UI ให้เหมาะสม
        const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth <= 1194;

        const theme = isHead
            ? { hexColor: '#7c3aed', iconBg: '#7c3aed', title: 'HEAD NURSE', sub: 'ADMINISTRATION', homeLink: 'Headnurse_dashboard.html', notiLink: 'notifications.html', userIcon: 'fa-user-md' }
            : { hexColor: '#4f46e5', iconBg: '#4f46e5', title: `สวัสดี ${user.FirstName}`, sub: 'NURSE SYSTEM', homeLink: 'dashboard.html', notiLink: 'notifications.html', userIcon: 'fa-user-nurse' };

        this.innerHTML = `
        <header class="bg-white sticky top-0 w-full shadow-sm" style="z-index: 2000 !important; border-top: 4px solid ${theme.hexColor};">
            <div class="max-w-[1400px] mx-auto px-4 md:px-8 ${isLandscape ? 'py-2' : 'py-3'} flex justify-between items-center relative">
                
                <a href="${theme.homeLink}" class="flex items-center gap-3 shrink-0 group">
                    <div class="${isLandscape ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105" style="background-color: ${theme.iconBg};">
                        <i class="fas ${theme.userIcon} ${isLandscape ? 'text-sm' : 'text-lg'}"></i> 
                    </div>
                    <div class="flex flex-col">
                        <h1 class="${isLandscape ? 'text-sm' : 'text-sm sm:text-lg'} font-bold text-slate-800 leading-none">${theme.title}</h1>
                        <p class="text-[9px] text-slate-400 font-medium tracking-wide mt-1 uppercase">${theme.sub}</p>
                    </div>
                </a>

                <div class="flex items-center gap-3 sm:gap-5 shrink-0">
                    
                    <div class="relative inline-block">
                        <button id="noti-trigger" class="relative p-2 rounded-full hover:bg-slate-50 transition-all group focus:outline-none">
                            <i class="fas fa-bell ${isLandscape ? 'text-xl' : 'text-2xl'} text-slate-400 transition-colors group-hover:text-indigo-500"></i>
                            <span id="unread-count" class="hidden absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white shadow-sm ring-1 ring-red-200">0</span>
                        </button>
                        
                        <div id="noti-dropdown" class="hidden absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[92vw] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden origin-top transition-all duration-200" style="z-index: 2001;">
                            <div class="px-4 py-3 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
                                <h3 class="text-sm font-bold text-slate-700">การแจ้งเตือน</h3>
                                <span class="text-[10px] text-slate-400">ล่าสุด</span>
                            </div>
                            <div id="noti-list" class="max-h-80 overflow-y-auto custom-scrollbar">
                                <div class="p-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                            </div>
                            <a href="${theme.notiLink}" class="block bg-slate-50 py-3 text-center text-xs font-bold text-indigo-500 hover:text-indigo-600 hover:bg-slate-100 border-t border-slate-100 transition-colors">ดูทั้งหมด</a>
                        </div>
                    </div>

                    <div id="profile-menu-trigger" class="relative flex items-center gap-2 cursor-pointer bg-white hover:bg-slate-50 py-1 pl-1 pr-3 rounded-full border border-slate-200 shadow-sm transition-all min-w-fit">
                        <img id="header-avatar" class="${isLandscape ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover border border-slate-100 shadow-sm shrink-0" src="${getProfileImageUrl(user.ProfileImage)}" onerror="this.src='https://placehold.co/100?text=User'">
                        <div class="flex flex-col items-start leading-tight">
                            <span class="text-sm font-bold text-slate-700 truncate max-w-[100px]">${user.FirstName}</span>
                            <span class="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5 tracking-tight uppercase">
                                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> ONLINE
                            </span>
                        </div>
                        <i class="fas fa-chevron-down text-xs text-slate-400 ml-1 shrink-0"></i>
                    </div>
                </div>
            </div>
        </header>`;

        this.setupProfileLogic(user); // ตั้งค่าเมนูโปรไฟล์
        this.setupNotiLogic(user);    // ตั้งค่าระบบแจ้งเตือน
        this.fetchBadgeCount(user);   // ดึงจำนวนรายการค้าง
    }

    // --- Logic ส่วนการจัดการ Notification และ Profile คัดลอกจาก components.js เดิมของคุณ ---
    setupNotiLogic(user) {
        const trigger = this.querySelector('#noti-trigger');
        const dropdown = this.querySelector('#noti-dropdown');
        const listContainer = this.querySelector('#noti-list');
        trigger.addEventListener('click', async (e) => {
            e.stopPropagation();
            const profileDropdown = document.getElementById('global-custom-dropdown');
            if(profileDropdown) profileDropdown.classList.add('hidden');
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                await this.loadNotificationsInDropdown(user, listContainer);
            }
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !trigger.contains(e.target)) dropdown.classList.add('hidden');
        });
    }

    async loadNotificationsInDropdown(user, container) {
        try {
            // --- ขั้นตอนที่ 1: พยายามดึงข้อมูลครั้งแรก ---
            let res = await apiRequest(`${API_BASE}/api/notifications/all/${user.UserID}`);
            
            // --- ขั้นตอนที่ 2: ถ้า Server ยุ่ง (เช่น Error 520) ให้รอ 1 วินาทีแล้วลองใหม่ 1 ครั้ง ---
            if (!res.ok) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                res = await apiRequest(`${API_BASE}/api/notifications/all/${user.UserID}`);
            }

            const data = await res.json();
            container.innerHTML = ""; 

            if (!data.success || data.notifications.length === 0) {
                container.innerHTML = `<div class="p-10 text-center text-slate-400 text-xs">ไม่มีการแจ้งเตือนใหม่</div>`;
                return;
            }

            // แสดงรายการแจ้งเตือน 5 รายการล่าสุด
            data.notifications.slice(0, 5).forEach(noti => {
                const timeAgo = moment(noti.created_at).fromNow();
                const isSystem = noti.type === 'system';
                const iconBg = isSystem ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500';
                
                container.innerHTML += `
                <div class="px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors" onclick="window.location.href='notifications.html'">
                    <div class="flex gap-3 items-start">
                        <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0 text-[10px]">
                            <i class="fas ${isSystem ? 'fa-check' : 'fa-exchange-alt'}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-2">
                                <h4 class="text-xs font-bold text-slate-800 truncate">${isSystem ? 'ระบบ' : (noti.FirstName || 'แจ้งเตือน')}</h4>
                                <span class="text-[9px] text-slate-400 whitespace-nowrap">${timeAgo}</span>
                            </div>
                            <p class="text-[10px] text-slate-500 truncate mt-0.5 font-light">${noti.info}</p>
                        </div>
                    </div>
                </div>`;
            });

        } catch (err) { 
            console.error("Notification Dropdown Error:", err);
            // --- ขั้นตอนที่ 3: เปลี่ยนข้อความ Error ให้ซอฟต์ลง และเพิ่มปุ่มลองใหม่ ---
            container.innerHTML = `
                <div class="p-8 text-center">
                    <i class="fas fa-cloud-sun text-slate-200 text-2xl mb-2"></i>
                    <p class="text-[10px] text-slate-400">การเชื่อมต่อขัดข้องชั่วคราว</p>
                    <button onclick="location.reload()" class="mt-2 text-[10px] text-indigo-500 font-bold hover:underline">
                        คลิกเพื่อลองใหม่
                    </button>
                </div>`;
        }
    }
    async fetchBadgeCount(user) {
        // หน่วงเวลา 1.5 วินาทีเพื่อให้ API หลักของ Dashboard ทำงานเสร็จก่อน
        await new Promise(r => setTimeout(r, 1500)); 

        try {
            const token = localStorage.getItem('token');
            const isHead = user.RoleID === 1;
            const endpoint = isHead ? '/api/admin/pending-counts' : `/api/notifications/unread-count/${user.UserID}`;
            
            const res = await fetch(`${API_BASE}${endpoint}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });

            // ตรวจสอบว่า Response โอเคไหม ถ้าไม่โอเค (เช่น 520) ให้เด้งไป catch
            if (!res.ok) throw new Error("Server Busy");

            const data = await res.json();
            if (data.success) {
                const badge = this.querySelector('#unread-count');
                const count = isHead ? (data.total || 0) : (data.count || 0);
                if (badge) {
                    badge.innerText = count > 99 ? '99+' : count;
                    count > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
                }
            }
        } catch (err) { 
            console.error("Badge Fetch Error, Retrying in 3s...", err);
            // ถ้าพลาด ให้ลองใหม่ในอีก 3 วินาที (แบบ Recursive)
            setTimeout(() => this.fetchBadgeCount(user), 3000); 
        }
    }

    setupProfileLogic(user) {
        const trigger = this.querySelector('#profile-menu-trigger');
        let dropdown = document.getElementById('global-custom-dropdown');
        if (!dropdown) {
            document.body.insertAdjacentHTML('afterbegin', `
            <div id="global-custom-dropdown" class="hidden fixed w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 origin-top-right transition-all duration-200" style="z-index: 9999 !important;"> 
                <a href="profile-edit.html" class="flex items-center px-4 py-2 text-[12px] text-slate-600 hover:bg-slate-50"><i class="fas fa-user-edit w-5 mr-2 text-indigo-500"></i> แก้ไขโปรไฟล์</a>
                <div class="border-t border-slate-100 my-1"></div>
                <button id="header-logout-btn" class="w-full text-left flex items-center px-4 py-2 text-[12px] text-red-500 hover:bg-red-50"><i class="fas fa-sign-out-alt w-5 mr-2"></i> ออกจากระบบ</button>
            </div>`);
            dropdown = document.getElementById('global-custom-dropdown');
        }
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const triggerRect = trigger.getBoundingClientRect();
            dropdown.style.top = `${triggerRect.bottom + 10}px`; 
            dropdown.style.right = `${window.innerWidth - triggerRect.right}px`;
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => dropdown.classList.add('hidden'));
        dropdown.querySelector('#header-logout-btn').onclick = () => logout();
    }
}
customElements.define('app-header', AppHeader);

// --- App Navbar (เมนูล่าง Auto-Hide) ---
// --- App Navbar (เมนูล่าง Auto-Hide & Responsive for iPad) ---
class AppNavbar extends HTMLElement {
    constructor() {
        super();
        // ฟังก์ชันสำหรับสั่งเปิด/ปิด Nav จากภายนอก
        window.toggleBottomNav = (show) => {
            const nav = this.querySelector('nav');
            if (!nav) return;
            show === undefined 
                ? nav.classList.toggle('nav-hidden') 
                : (show ? nav.classList.remove('nav-hidden') : nav.classList.add('nav-hidden'));
        };
    }

    connectedCallback() { 
        this.render(); 
        this.initScrollEffect(); 
    }

    // ระบบซ่อนเมนูอัตโนมัติเมื่อเลื่อนลง (Scroll Down to Hide)
    initScrollEffect() {
    let lastScrollY = window.scrollY;
    // เก็บฟังก์ชันไว้ใน property ของ class
    this._handleScroll = () => {
        const nav = this.querySelector('nav');
        if (!nav) return;
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
            nav.classList.add('nav-hidden');
        } else {
            nav.classList.remove('nav-hidden');
        }
        lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', this._handleScroll, { passive: true });
}

    disconnectedCallback() { 
        // ลบ listener ออกโดยอ้างอิงฟังก์ชันเดิม
        window.removeEventListener('scroll', this._handleScroll); 
    }

    render() {
        const user = getUser(); 
        if (!user) return;

        const isHead = user.RoleID === 1;
        // กำหนดเมนูตามสิทธิ์การใช้งาน
        const menus = isHead 
            ? [ 
                { href: 'Headnurse_dashboard.html', icon: 'fa-chart-line', label: 'ภาพรวม' }, 
                { href: 'swap_request.html', icon: 'fa-exchange-alt', label: 'แลกเวร' }, 
                { href: 'trade_market.html', icon: 'fa-shopping-cart', label: 'ซื้อขาย' }, 
                { href: 'schedule.html', icon: 'fa-calendar-alt', label: 'ตารางเวร' }, 
                { href: 'nurse_list.html', icon: 'fa-user-nurse', label: 'บุคลากร' }, 
                { href: 'state.html', icon: 'fa-chart-bar', label: 'สถิติ' } 
              ]
            : [ 
                { href: 'dashboard.html', icon: 'fa-home', label: 'หน้าหลัก' }, 
                { href: 'swap_request.html', icon: 'fa-exchange-alt', label: 'แลกเวร' }, 
                { href: 'trade_market.html', icon: 'fa-shopping-cart', label: 'ซื้อขาย' }, 
                { href: 'schedule.html', icon: 'fa-calendar-alt', label: 'ตารางเวร' }, 
                { href: 'statistics.html', icon: 'fa-chart-bar', label: 'สถิติ' } 
              ];

        const activeColor = isHead ? 'text-violet-600' : 'text-indigo-600';
        const barColor = isHead ? 'bg-violet-600' : 'bg-indigo-600';
        
        const menuHtml = menus.map(m => {
            const isActive = window.location.href.includes(m.href);
            return `
            <a href="${m.href}" class="flex flex-col items-center justify-center relative w-full h-full group transition-all duration-200 ${isActive ? activeColor : 'text-gray-400 hover:text-gray-600'}">
                ${isActive ? `<div class="absolute top-0 w-8 h-1 ${barColor} rounded-b-lg shadow-sm"></div>` : ''}
                <i class="fas ${m.icon} text-xl mb-1 transition-transform group-hover:-translate-y-1"></i>
                <span class="text-[10px] font-bold tracking-tight">${m.label}</span>
            </a>`;
        }).join('');

        this.innerHTML = `
        <style>
            app-navbar nav { 
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; 
            }
            app-navbar nav.nav-hidden { 
                transform: translateY(100%); 
                opacity: 0; 
                pointer-events: none; 
            }
            
            /* 🔥 แก้ปัญหา iPad แนวนอน: จำกัดความกว้างเมนูไม่ให้ห่างกันเกินไป */
            @media (min-width: 768px) {
                app-navbar nav div.menu-container {
                    max-width: 800px !important; 
                    margin: 0 auto;
                    padding: 0 20px;
                }
            }
        </style>
        <nav class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div class="menu-container flex justify-between items-center h-16">
                ${menuHtml}
            </div>
        </nav>`;
    }
}

if (!customElements.get('app-navbar')) {
    customElements.define('app-navbar', AppNavbar);
}

// --- App Date Picker ---
class AppDatePicker extends HTMLElement {
    connectedCallback() {
        const placeholder = this.getAttribute('placeholder') || 'เลือกวันที่...';
        const id = this.getAttribute('input-id') || 'datepicker-' + Math.random().toString(36).substr(2, 9);
        this.innerHTML = `<div class="relative group"><input type="text" id="${id}" class="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 pl-11 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition outline-none cursor-pointer" placeholder="${placeholder}"><i class="fas fa-calendar-alt absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors pointer-events-none"></i></div>`;
        setTimeout(() => { if (typeof flatpickr !== 'undefined') { flatpickr(`#${id}`, { locale: "th", dateFormat: "Y-m-d", altInput: true, altFormat: "j F Y", disableMobile: true, onChange: (d, dateStr) => { this.dispatchEvent(new CustomEvent('date-change', { detail: { date: dateStr } })); } }); } }, 0);
    }
}
if (!customElements.get('app-date-picker')) customElements.define('app-date-picker', AppDatePicker);

// =========================================================
// 3. AUTO LOGOUT SYSTEM (Idle 15 Minutes)
// =========================================================
(function() {
    const IDLE_TIMEOUT = 15 * 60 * 1000;
    let idleTimer;
    const performLogout = () => {
        if (!getUser()) return;
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'หมดเวลาการใช้งาน', text: 'คุณไม่ได้ทำรายการเกิน 15 นาที ระบบจะนำคุณกลับไปหน้า Login', timer: 4000, timerProgressBar: true, showConfirmButton: false, allowOutsideClick: false }).then(() => logout());
        } else {
            alert('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
            logout();
        }
    };
    const resetTimer = () => { if (!localStorage.getItem('user')) return; clearTimeout(idleTimer); idleTimer = setTimeout(performLogout, IDLE_TIMEOUT); };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();
})();

// =========================================================
// 4. HELPER COMPONENTS
// =========================================================
function LogoComponent() { return `<div class="logo"><img src="logo.png" alt="Logo" class="logo-img"><span class="logo-text">AUTONURSESHIFT</span></div>`; }
function SuccessCardComponent(props) {
    const { title, message, btnText, btnLink } = props;
    const messageHtml = message.map(text => `<span class="sub-text">${text}</span>`).join('');
    return `<div class="success-box fade-in"><div class="success-icon"><i class="fas fa-check-circle"></i></div><h2>${title}</h2><div class="text-wrapper">${messageHtml}</div><a href="${btnLink}" class="goto-login-btn">${btnText}</a></div>`;
}

// =========================================================
// 5. SMART REAL-TIME NOTIFICATION (SOCKET.IO)
// =========================================================

function showSmartToast(message) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast'; 
    toast.innerHTML = `
        <div style="margin-right: 15px; font-size: 20px;">🔔</div>
        <div><strong style="display: block; color: #333;">แจ้งเตือนใหม่</strong><small style="color: #666;">${message}</small></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 500); }, 5000);
}

function initSocketNotificationSystem() {
    if (window.socket && window.socket.connected) return;

    const user = getUser();
    const token = localStorage.getItem('token');
    if (!user || !token) return;

    console.log("🚀 Starting Real-time Notification System (Socket.io)...");

    // สร้างการเชื่อมต่อ
    window.socket = io(API_BASE, {
        transports: ["websocket"],
        withCredentials: true,
        reconnection: true
    });

    // เมื่อเชื่อมต่อสำเร็จ
    window.socket.on('connect', () => {
        console.log('✅ Socket connected. ID:', window.socket.id);
        window.socket.emit('register_user', user.UserID);
    });
    window.socket.on('force_logout', () => {
        console.log("⚠️ Received force_logout command");
        
        localStorage.clear(); // ล้างข้อมูลกุญแจเก่าทิ้งทั้งหมด
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'เซสชั่นหมดอายุ',
                text: 'รหัสผ่านถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่เพื่อความปลอดภัย',
                confirmButtonColor: '#191970',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'login.html';
            });
        } else {
            alert('รหัสผ่านถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่');
            window.location.href = 'login.html';
        }
    });
    // เมื่อได้รับการแจ้งเตือนใหม่ (Real-time)
    window.socket.on('receive_notification', (data) => {
        // แสดง Toast แจ้งเตือน
        showSmartToast(data.message || "มีรายการอัปเดตใหม่ส่งถึงคุณ!");

        // อัปเดตตัวเลข Badge ทันที
        const badge = document.querySelector('#unread-count');
        if (badge && data.unreadCount !== undefined) {
            badge.innerText = data.unreadCount > 99 ? '99+' : data.unreadCount;
            if (data.unreadCount > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // รีเฟรชรายการในหน้า notifications.html (ถ้าเปิดอยู่)
        if (typeof loadNotifications === 'function') loadNotifications();
    });

    window.socket.on('connect_error', (err) => console.error('❌ Socket Error:', err.message));
}

// เริ่มระบบแจ้งเตือนอัตโนมัติ (Self-Invoking)
(function() {
    const user = getUser();
    const token = localStorage.getItem('token');
    if (user && token) {
        initSocketNotificationSystem();
    }
})();
