export default function manifest() {
    return {
        name: 'n+ Rewards Membership',
        short_name: 'n+ Rewards',
        description: 'Hotel n plus exclusive rewards and membership app',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000', // 추후 브랜드 컬러로 꼭 변경하세요
        icons: [
            {
                src: '/logo192.png', // 💡 사용자의 실제 파일명으로 수정됨
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/logo512.png', // 💡 사용자의 실제 파일명으로 수정됨
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}