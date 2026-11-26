import { env } from './env.js';
import { isMockDb } from '../db/index.js';
import { defaultContent } from './content.js';

export function isDemoMode(url = null) {
  const raw = env('DEMO_MODE')?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  if (url?.searchParams?.get('demo') === '1') return true;
  return isMockDb;
}

function futureDateISO(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function buildDemoInvitationData({ heroImg, coupleImg, stationeryImg }) {
  const images = new Map([
    [
      'demo-hero',
      {
        url: heroImg.src,
        thumb: heroImg.src,
        medium: heroImg.src,
        width: heroImg.width,
        height: heroImg.height,
      },
    ],
    [
      'demo-couple',
      {
        url: coupleImg.src,
        thumb: coupleImg.src,
        medium: coupleImg.src,
        width: coupleImg.width,
        height: coupleImg.height,
      },
    ],
    [
      'demo-stationery',
      {
        url: stationeryImg.src,
        thumb: stationeryImg.src,
        medium: stationeryImg.src,
        width: stationeryImg.width,
        height: stationeryImg.height,
      },
    ],
  ]);

  const eventDate = futureDateISO(45);
  const base = defaultContent();

  const content = {
    ...base,
    theme: {
      primaryColor: '#8b7561',
      pattern: { kind: 'leaf', opacity: 12, all: true },
      animation: { enabled: true, all: true },
    },
    sections: {
      ...base.sections,
      cover: {
        ...base.sections.cover,
        enabled: true,
        heading: 'The Wedding Of',
        imageId: 'demo-hero',
        extraImageIds: ['demo-couple'],
        slideshow: { interval: 5, zoom: true },
        style: { layout: 'centered' },
      },
      couple: {
        ...base.sections.couple,
        enabled: true,
        intro:
          'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan acara pernikahan putra-putri kami.',
        bride: {
          name: 'Sarah',
          fullName: 'Sarah Wijaya, S.Ars.',
          parents: 'Bapak Hendra Wijaya & Ibu Ratna Kusuma',
          photoId: 'demo-couple',
          photoPos: { x: 35, y: 28 },
        },
        groom: {
          name: 'Andi',
          fullName: 'Andi Pratama, S.T.',
          parents: 'Bapak Bambang Pratama & Ibu Sari Dewi',
          photoId: 'demo-couple',
          photoPos: { x: 68, y: 28 },
        },
        style: { ...base.sections.couple.style, layout: 'split', frame: 'arch', animate: true },
      },
      event: {
        ...base.sections.event,
        enabled: true,
        timezone: 'Asia/Jakarta',
        items: [
          {
            key: 'akad',
            label: 'Akad Nikah',
            date: eventDate,
            startTime: '08:00',
            endTime: '10:00',
            venue: 'Masjid Agung Al-Azhar',
            address: 'Jl. Sisingamangaraja, Kebayoran Baru, Jakarta Selatan',
          },
          {
            key: 'resepsi',
            label: 'Resepsi Pernikahan',
            date: eventDate,
            startTime: '11:00',
            endTime: '14:00',
            venue: 'Plataran Menteng Pavilion',
            address: 'Jl. H.O.S. Cokroaminoto No. 42, Menteng, Jakarta Pusat',
          },
        ],
        style: { ...base.sections.event.style, surface: 'white', layout: 'centered', animate: true },
      },
      countdown: {
        ...base.sections.countdown,
        enabled: true,
        style: { ...base.sections.countdown.style, surface: 'solid', layout: 'centered', animate: true },
      },
      story: {
        ...base.sections.story,
        enabled: true,
        items: [
          {
            title: 'Pertemuan Pertama',
            date: 'Mei 2022',
            text: 'Berawal dari diskusi proyek arsitektur di Jakarta Selatan yang mempertemukan kami untuk pertama kalinya.',
          },
          {
            title: 'Melangkah Bersama',
            date: 'November 2024',
            text: 'Dua tahun berbagi cerita dan mimpi membawa keyakinan bagi kami untuk saling menjaga dalam satu tujuan.',
          },
          {
            title: 'Lamaran Keluarga',
            date: 'Agustus 2026',
            text: 'Kedua keluarga bertemu dengan hangat dan merestui langkah kami menuju hari bahagia.',
          },
        ],
        style: { ...base.sections.story.style, surface: 'plain', timeline: 'alternate', animate: true },
      },
      gallery: {
        ...base.sections.gallery,
        enabled: true,
        imageIds: ['demo-hero', 'demo-couple', 'demo-stationery'],
        style: { ...base.sections.gallery.style, surface: 'white', layout: 'grid', animate: true },
      },
      location: {
        ...base.sections.location,
        enabled: true,
        venueName: 'Plataran Menteng Pavilion',
        address: 'Jl. H.O.S. Cokroaminoto No. 42, Menteng, Jakarta Pusat',
        mapsUrl: 'https://maps.google.com/?q=Plataran+Menteng+Jakarta',
        style: { ...base.sections.location.style, surface: 'plain', layout: 'centered', animate: true },
      },
      gift: {
        ...base.sections.gift,
        enabled: true,
        intro:
          'Kehadiran dan doa restu Anda sudah merupakan hadiah terindah bagi kami. Namun apabila ingin memberikan tanda kasih, dapat disalurkan melalui rekening berikut:',
        qrisImageId: null,
        accounts: [
          { bank: 'BCA', number: '1234567890', holder: 'Sarah Wijaya (Contoh)' },
          { bank: 'Mandiri', number: '9876543210', holder: 'Andi Pratama (Contoh)' },
        ],
        style: { ...base.sections.gift.style, surface: 'tint', layout: 'centered', animate: true },
      },
      rsvp: {
        ...base.sections.rsvp,
        enabled: true,
        style: { ...base.sections.rsvp.style, surface: 'white', animate: true },
      },
      wishes: {
        ...base.sections.wishes,
        enabled: true,
        style: { ...base.sections.wishes.style, surface: 'plain', animate: true },
      },
      closing: {
        ...base.sections.closing,
        enabled: true,
        message:
          'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.',
        style: { ...base.sections.closing.style, surface: 'tint', layout: 'centered', animate: true },
      },
    },
  };

  const invitation = {
    id: 'demo-showcase',
    slug: 'demo',
    title: 'Undangan Pernikahan Sarah & Andi (Demo)',
    status: 'draft',
    templateKey: 'classic',
    isDisabled: false,
  };

  const wishes = [
    {
      id: 'demo-wish-1',
      guestName: 'Budi Santoso',
      message: 'Selamat menempuh hidup baru Sarah & Andi! Semoga menjadi keluarga sakinah, mawaddah, warahmah.',
      createdAt: new Date(Date.now() - 2 * 3600_000),
    },
    {
      id: 'demo-wish-2',
      guestName: 'Nadia Kusuma',
      message: 'Turut berbahagia untuk kalian berdua. Sampai jumpa di acara resepsi nanti!',
      createdAt: new Date(Date.now() - 18 * 3600_000),
    },
    {
      id: 'demo-wish-3',
      guestName: 'Raka Pratama',
      message: 'Lancar sampai hari H ya, semoga selalu diberkahi kebahagiaan bersama.',
      createdAt: new Date(Date.now() - 36 * 3600_000),
    },
  ];

  return { invitation, content, images, wishes, hasMoreWishes: false };
}
