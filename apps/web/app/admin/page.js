"use client";
import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const BASE_URL = '';
const emptySubscribe = () => () => {};

const passthroughImageLoader = ({ src }) => src;

function AdminPreviewImage({
  src,
  alt,
  className,
  fill = false,
  width = 1200,
  height = 800,
  sizes,
}) {
  return (
    <Image
      loader={passthroughImageLoader}
      unoptimized
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
    />
  );
}

const DEFAULT_HOTEL_CODE = process.env.NEXT_PUBLIC_HOTEL_CODE || 'NPLUS01';

const resolveHotelCode = () => {
  if (typeof window === "undefined") return DEFAULT_HOTEL_CODE;

  const params = new URLSearchParams(window.location.search);
  const hotelParam = params.get("hotel")?.trim();
  if (hotelParam) return hotelParam;

  const storedHotelCode = window.localStorage.getItem("hotelCode")?.trim();
  if (storedHotelCode) return storedHotelCode;

  return DEFAULT_HOTEL_CODE;
};

export default function AdminRoomManager() {
  const hotelCode = useSyncExternalStore(
    emptySubscribe,
    resolveHotelCode,
    () => DEFAULT_HOTEL_CODE,
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginData, setLoginData] = useState({ user_id: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [savedRooms, setSavedRooms] = useState([]);
  const [websiteConfig, setWebsiteConfig] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'success' });

  // 요금 설정 상태
  const [globalFees, setGlobalFees] = useState({ childFee: 500, extraBedFee: 1000 });
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nameEn: "", nameKo: "", nameZh: "", nameJa: "",
    price: "", maxGuests: "2", size: "", bedType: "",
    descEn: "", descKo: "", descZh: "", descJa: ""
  });
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [listingSettings, setListingSettings] = useState({
    hotelName: "",
    province: "",
    cityMunicipal: "",
    address: "",
    googleMapLink: "",
  });

  const fetchRooms = useCallback(async () => {
    try {
      // 💡 꼬리표 달기
      const res = await fetch(`${BASE_URL}/api/admin/room-types?hotel=${hotelCode}`);
      const data = await res.json();
      if(data.success) setSavedRooms(data.rooms);
    } catch (e) { console.error(e); }
  }, [hotelCode]);

  const fetchFees = useCallback(async () => {
    try {
        // 💡 꼬리표 달기
        const res = await fetch(`${BASE_URL}/api/settings/fees?hotel=${hotelCode}`);
        const data = await res.json();
        if (data.success && data.fees) {
            setGlobalFees({ childFee: data.fees.child_fee, extraBedFee: data.fees.extra_bed_fee });
        }
    } catch (e) { console.error(e); }
  }, [hotelCode]);

  const fetchWebsiteSettings = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/settings/website?hotel=${hotelCode}`);
      const data = await res.json();
      if (!(data.success && data.config)) return;

      setWebsiteConfig(data.config);

      let sns = {};
      try {
        sns = data.config.sns_json
          ? typeof data.config.sns_json === "string"
            ? JSON.parse(data.config.sns_json)
            : data.config.sns_json
          : {};
      } catch {
        sns = {};
      }

      setListingSettings({
        hotelName: data.config.hotel_name || sns.hotel_name || sns.title || data.config.footer_company_name || "",
        province: data.config.province || data.config.property_province || sns.province || "",
        cityMunicipal: data.config.city_municipality || data.config.city || sns.city_municipality || sns.city || sns.municipality || "",
        address: sns.address || data.config.address || data.config.property_address || "",
        googleMapLink: data.config.map_embed_url || data.config.map_url || sns.map_link || "",
      });
    } catch (e) { console.error(e); }
  }, [hotelCode]);

  useEffect(() => {
    if (isLoggedIn) {
        fetchRooms();
        fetchFees(); 
        fetchWebsiteSettings();
    }
  }, [fetchFees, fetchRooms, fetchWebsiteSettings, isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${BASE_URL}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...loginData, hotel_code: hotelCode }) // 💡 소속 호텔 코드로 로그인 
      });
      const data = await res.json();
      if (data.success && (data.role === 'Master' || data.role === 'FrontDesk')) setIsLoggedIn(true);
      else setLoginError("Invalid User ID or insufficient permissions.");
    } catch (err) { setLoginError("Failed to connect to the PMS server."); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleListingSettingsChange = (e) => {
    const { name, value } = e.target;
    setListingSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    e.target.value = '';
  };

  const removeNewPhoto = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };
  const removeExistingPhoto = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditRoom = (room) => {
    setEditingId(room.id);
    setFormData({
      nameEn: room.name?.en || "", nameKo: room.name?.ko || "", nameZh: room.name?.zh || "", nameJa: room.name?.ja || "",
      price: room.price || "", maxGuests: room.maxGuests || "2", size: room.roomConfig?.size || "", bedType: room.roomConfig?.bedType || "",
      descEn: room.description?.en || "", descKo: room.description?.ko || "", descZh: room.description?.zh || "", descJa: room.description?.ja || ""
    });
    setExistingImages(room.images || []); setSelectedFiles([]); setPreviewUrls([]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ nameEn: "", nameKo: "", nameZh: "", nameJa: "", price: "", maxGuests: "2", size: "", bedType: "", descEn: "", descKo: "", descZh: "", descJa: "" });
    setExistingImages([]); setSelectedFiles([]); setPreviewUrls([]);
  };

  const handleSaveFees = async () => {
    setIsSavingFees(true);
    try {
        const res = await fetch(`${BASE_URL}/api/settings/fees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...globalFees, hotel_code: hotelCode }) // 💡 호텔 코드 쏘기
        });
        const data = await res.json();
        if (data.success) {
            setModal({ show: true, type: 'success', title: 'Settings Saved', message: 'Extra fees configuration has been successfully updated!' });
        } else {
            setModal({ show: true, type: 'error', title: 'Error', message: 'Failed to save settings: ' + data.error });
        }
    } catch (error) {
        setModal({ show: true, type: 'error', title: 'Network Error', message: 'Could not connect to the server.' });
    } finally {
        setIsSavingFees(false);
    }
  };

  const handleSaveWebsiteSettings = async () => {
    if (!websiteConfig) return;

    setIsSavingWebsite(true);
    try {
      let existingSns = {};
      try {
        existingSns = websiteConfig.sns_json
          ? typeof websiteConfig.sns_json === "string"
            ? JSON.parse(websiteConfig.sns_json)
            : websiteConfig.sns_json
          : {};
      } catch {
        existingSns = {};
      }

      const payload = {
        ...websiteConfig,
        hotel_code: hotelCode,
        hotel_name: listingSettings.hotelName,
        footer_company_name: listingSettings.hotelName,
        province: listingSettings.province,
        city_municipality: listingSettings.cityMunicipal,
        map_embed_url: listingSettings.googleMapLink,
        sns_json: JSON.stringify({
          ...existingSns,
          title: listingSettings.hotelName,
          hotel_name: listingSettings.hotelName,
          province: listingSettings.province,
          city_municipality: listingSettings.cityMunicipal,
          address: listingSettings.address,
          map_link: listingSettings.googleMapLink,
        }),
      };

      const res = await fetch(`${BASE_URL}/api/settings/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setModal({ show: true, type: "success", title: "Website Settings Saved", message: "Hotel listing and map settings have been updated." });
        fetchWebsiteSettings();
      } else {
        setModal({ show: true, type: "error", title: "Error", message: data.error || data.message || "Failed to save website settings." });
      }
    } catch (error) {
      setModal({ show: true, type: "error", title: "Network Error", message: "Could not connect to the server." });
    } finally {
      setIsSavingWebsite(false);
    }
  };

  const handleDeleteRoom = async (id, nameEn) => {
    const confirmDelete = window.confirm(`Are you sure you want to completely delete '${nameEn || 'this room'}'?\n\nThis will remove it from both the Website and the PMS.`);
    if (!confirmDelete) return;

    try {
        // 💡 URL 파라미터로 꼬리표 달기
        const response = await fetch(`${BASE_URL}/api/admin/room-types/${id}?name=${encodeURIComponent(nameEn || '')}&hotel=${hotelCode}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            setModal({ show: true, type: 'success', title: 'Success', message: 'Room successfully deleted!' });
            fetchRooms(); 
            if (editingId === id) handleCancelEdit(); 
        } else {
            setModal({ show: true, type: 'error', title: 'Error', message: 'Failed to delete room: ' + result.error });
        }
    } catch (error) { setModal({ show: true, type: 'error', title: 'Network Error', message: 'Could not connect to the server.' }); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    selectedFiles.forEach(file => submitData.append("images", file));
    
    // 💡 폼 데이터에 호텔 코드 끼워넣기
    submitData.append("hotel_code", hotelCode);

    if (editingId) {
        submitData.append("roomId", editingId);
        submitData.append("existingImages", JSON.stringify(existingImages));
    }

    try {
      const response = await fetch(`${BASE_URL}/api/admin/room-types/sync`, { method: "POST", body: submitData });
      const result = await response.json();
      
      if (result.success) {
        setModal({ show: true, type: 'success', title: 'Sync Successful', message: editingId ? "Successfully updated and synced the room!" : "Successfully created and synced new room!" });
        handleCancelEdit(); fetchRooms(); 
      } else {
        setModal({ show: true, type: 'error', title: 'Sync Failed', message: result.error });
      }
    } catch (error) { setModal({ show: true, type: 'error', title: 'Network Error', message: 'Could not connect to the server.' }); } 
    finally { setIsSubmitting(false); }
  };

  if (!isLoggedIn) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
            <div className="text-center mb-8"><h1 className="text-3xl font-black text-emerald tracking-tighter">Web Admin</h1><p className="text-gray-500 mt-2 text-sm font-medium">Property: {hotelCode}</p></div>
            {loginError && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-2 rounded">{loginError}</p>}
            <form onSubmit={handleLogin} className="space-y-6">
              <div><label className="block text-sm font-bold text-gray-700 mb-2">User ID</label><input type="text" required value={loginData.user_id} onChange={(e) => setLoginData({...loginData, user_id: e.target.value})} className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-emerald outline-none" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Password</label><input type="password" required value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-emerald outline-none" /></div>
              <button type="submit" className="w-full bg-emerald text-white font-bold py-3 rounded-lg hover:bg-emerald-dark transition">Secure Login</button>
            </form>
          </div>
        </div>
      );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-10 font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-emerald px-8 py-6 flex justify-between items-center rounded-2xl shadow-md">
          <div><h1 className="text-3xl font-bold text-white">Room Type Manager</h1><p className="text-emerald-100 mt-2 font-bold tracking-widest">[{hotelCode}] PROPERTY</p></div>
          <button onClick={() => setIsLoggedIn(false)} className="text-white text-sm font-bold border border-white px-4 py-2 rounded hover:bg-white hover:text-emerald transition">Logout</button>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-4">⚙️ Global Extra Fees Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Extra Bed Fee (PHP / night)</label>
                    <input type="number" value={globalFees.extraBedFee} onChange={e => setGlobalFees({...globalFees, extraBedFee: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Child Surcharge (PHP / night)</label>
                    <input type="number" value={globalFees.childFee} onChange={e => setGlobalFees({...globalFees, childFee: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800" />
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button onClick={handleSaveFees} disabled={isSavingFees} className={`font-bold py-3 px-8 rounded-xl shadow-md transition-all ${isSavingFees ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-emerald hover:bg-emerald-dark text-white hover:-translate-y-1 hover:shadow-lg'}`}>
                    {isSavingFees ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-4">🏨 Portal Listing & Map Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Hotel Name</label>
                    <input
                      type="text"
                      name="hotelName"
                      value={listingSettings.hotelName}
                      onChange={handleListingSettingsChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800"
                      placeholder="Bayfront Hotel"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Province</label>
                    <input
                      type="text"
                      name="province"
                      value={listingSettings.province}
                      onChange={handleListingSettingsChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800"
                      placeholder="Cebu"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">City / Municipal</label>
                    <input
                      type="text"
                      name="cityMunicipal"
                      value={listingSettings.cityMunicipal}
                      onChange={handleListingSettingsChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800"
                      placeholder="Cebu City"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Google Map Link</label>
                    <input
                      type="text"
                      name="googleMapLink"
                      value={listingSettings.googleMapLink}
                      onChange={handleListingSettingsChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800"
                      placeholder="https://maps.google.com/..."
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-600 mb-2">Property Address</label>
                    <input
                      type="text"
                      name="address"
                      value={listingSettings.address}
                      onChange={handleListingSettingsChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none font-bold text-gray-800"
                      placeholder="Street, Barangay, City, Province"
                    />
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button onClick={handleSaveWebsiteSettings} disabled={isSavingWebsite} className={`font-bold py-3 px-8 rounded-xl shadow-md transition-all ${isSavingWebsite ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-emerald hover:bg-emerald-dark text-white hover:-translate-y-1 hover:shadow-lg'}`}>
                    {isSavingWebsite ? 'Saving...' : 'Save Listing Settings'}
                </button>
            </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-xl font-black text-gray-800">Published Rooms ({savedRooms.length})</h3>
                <button onClick={handleCancelEdit} className="bg-emerald-100 text-emerald-800 font-bold px-4 py-2 rounded-lg text-sm hover:bg-emerald-200 transition">➕ Add New Room</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {savedRooms.length === 0 && <p className="text-gray-400 font-bold col-span-4 text-center py-10">No rooms published yet.</p>}
                {savedRooms.map(room => (
                    <div key={room.id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition">
                        <div>
                            <div className="relative h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                                {room.images && room.images[0] ? <AdminPreviewImage src={room.images[0]} alt="room" fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover"/> : <div className="flex items-center justify-center h-full text-gray-400">No Image</div>}
                            </div>
                            <h4 className="font-bold text-gray-800 text-lg">{room.name?.en || 'Unnamed'}</h4>
                            <p className="text-emerald font-black text-sm">₱{room.price?.toLocaleString()}</p>
                        </div>
                        
                        <div className="mt-4 flex gap-2 w-full">
                            <button onClick={() => handleEditRoom(room)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-bold text-sm transition">✏️ Edit Room</button>
                            <button onClick={() => handleDeleteRoom(room.id, room.name?.en)} className="bg-red-50 hover:bg-red-100 text-red-500 py-2 px-3 rounded-lg font-bold text-sm transition shadow-sm" title="Delete Room">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <form onSubmit={handleSubmit} className={`bg-white p-8 rounded-2xl shadow-xl border-t-8 transition-colors ${editingId ? 'border-amber-400' : 'border-emerald'}`}>
          <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h2 className="text-2xl font-black text-gray-800">{editingId ? '✏️ Edit Existing Room' : '✨ Create New Room'}</h2>
              {editingId && <button type="button" onClick={handleCancelEdit} className="text-red-500 font-bold hover:underline">Cancel Edit</button>}
          </div>
          
          <div className="space-y-10">
              <div>
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">1. Core Settings (PMS & Web)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Base Price (PHP)</label><input type="number" name="price" value={formData.price} onChange={handleInputChange} required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Max Guests</label><input type="number" name="maxGuests" value={formData.maxGuests} onChange={handleInputChange} required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Room Size (sqm)</label><input type="text" name="size" value={formData.size} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Bed Configuration</label><input type="text" name="bedType" value={formData.bedType} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">2. Multi-lingual Display Names</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-bold text-gray-600 mb-1">Name (English) {editingId && <span className="text-red-500 text-xs ml-2">* Cannot edit PMS ID</span>}</label>
                      <input type="text" name="nameEn" value={formData.nameEn} onChange={handleInputChange} required disabled={editingId !== null} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none disabled:bg-gray-100 disabled:text-gray-400" />
                  </div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Name (Korean)</label><input type="text" name="nameKo" value={formData.nameKo} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Name (Chinese)</label><input type="text" name="nameZh" value={formData.nameZh} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-1">Name (Japanese)</label><input type="text" name="nameJa" value={formData.nameJa} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald outline-none" /></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">3. Short Descriptions</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><textarea name="descEn" value={formData.descEn} onChange={handleInputChange} rows="2" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald outline-none" placeholder="English..." /></div>
                  <div><textarea name="descKo" value={formData.descKo} onChange={handleInputChange} rows="2" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald outline-none" placeholder="Korean..." /></div>
                  <div><textarea name="descZh" value={formData.descZh} onChange={handleInputChange} rows="2" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald outline-none" placeholder="Chinese..." /></div>
                  <div><textarea name="descJa" value={formData.descJa} onChange={handleInputChange} rows="2" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald outline-none" placeholder="Japanese..." /></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end border-b pb-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-800">4. Room Gallery</h3>
                  <div className="relative overflow-hidden cursor-pointer">
                    <button type="button" className="bg-emerald-100 text-emerald font-bold py-2 px-4 rounded-lg text-sm">+ Add Photos</button>
                    <input type="file" multiple accept="image/*" onChange={handleFileChange} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {existingImages.map((url, index) => (
                      <div key={`exist-${index}`} className="relative group rounded-lg overflow-hidden border-2 border-emerald shadow-sm aspect-video">
                        <AdminPreviewImage src={url} alt={`Existing ${index}`} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover opacity-80" />
                        <div className="absolute top-0 left-0 bg-emerald text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg">Saved</div>
                        <button type="button" onClick={() => removeExistingPhoto(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    
                    {previewUrls.map((url, index) => (
                      <div key={`new-${index}`} className="relative group rounded-lg overflow-hidden border border-gray-300 shadow-sm aspect-video">
                        <AdminPreviewImage src={url} alt={`New ${index}`} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
                        <div className="absolute top-0 left-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg">New</div>
                        <button type="button" onClick={() => removeNewPhoto(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className={`w-full py-4 text-white font-black text-xl rounded-xl shadow-lg transition-all ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald hover:bg-emerald-dark hover:shadow-xl'}`}>
                {isSubmitting ? "Uploading & Syncing..." : editingId ? "💾 Update & Sync Room" : "✨ Create & Sync Database"}
              </button>
          </div>
        </form>
      </div>

      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-all scale-100">
            <div className={`p-8 ${modal.type === 'success' ? 'bg-emerald' : modal.type === 'warning' ? 'bg-amber-400' : 'bg-red-500'}`}>
                <span className="text-6xl drop-shadow-lg">{modal.type === 'success' ? '✅' : modal.type === 'warning' ? '⚠️' : '❌'}</span>
            </div>
            <div className="p-8">
              <h3 className="text-xl font-black text-gray-800 mb-3">{modal.title}</h3>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap">{modal.message}</p>
              <button onClick={() => setModal({ show: false, title: '', message: '', type: 'success' })} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-lg ${modal.type === 'success' ? 'bg-emerald hover:bg-emerald-dark' : modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'}`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
