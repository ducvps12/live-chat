'use client';

import { useTranslation } from 'react-i18next';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation, Autoplay } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const roles = [
    {
        key: 'sales',
        icon: 'attach_money',
        iconColor: 'text-electric-blue',
        iconBg: 'bg-blue-50'
    },
    {
        key: 'support',
        icon: 'support_agent',
        iconColor: 'text-electric-teal',
        iconBg: 'bg-cyan-50'
    },
    {
        key: 'techSupport',
        icon: 'build',
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-50'
    },
    {
        key: 'manager',
        icon: 'monitoring',
        iconColor: 'text-gray-700',
        iconBg: 'bg-gray-100'
    },
    {
        key: 'developer',
        icon: 'code',
        iconColor: 'text-indigo-600',
        iconBg: 'bg-indigo-50'
    },
];

export default function RoleSolutions() {
    const { t } = useTranslation();

    return (
        <section className="py-20 px-6 relative z-10 bg-gray-50">
            <div className="max-w-screen-xl mx-auto">
                {/* Section Header */}
                <div className="mb-16 text-center">
                    <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                        {t('solutions.roles.title')}{' '}
                        <span className="text-purple-500">{t('solutions.roles.titleHighlight')}</span>
                    </h2>
                    <p className="text-gray-600 text-lg max-w-3xl mx-auto">
                        {t('solutions.roles.subtitle')}
                    </p>
                </div>

                {/* Swiper Carousel */}
                <div className="relative px-12">
                    <Swiper
                        grabCursor={true}
                        centeredSlides={false}
                        slidesPerView={1}
                        spaceBetween={24}
                        breakpoints={{
                            640: {
                                slidesPerView: 1,
                                spaceBetween: 20,
                            },
                            768: {
                                slidesPerView: 2,
                                spaceBetween: 24,
                            },
                            1024: {
                                slidesPerView: 3,
                                spaceBetween: 32,
                            },
                        }}
                        pagination={{
                            clickable: true,
                            dynamicBullets: false,
                        }}
                        navigation={true}
                        autoplay={{
                            delay: 4500,
                            disableOnInteraction: false,
                            pauseOnMouseEnter: true,
                        }}
                        loop={true}
                        modules={[Pagination, Navigation, Autoplay]}
                        className="role-swiper !pb-16"
                    >
                        {roles.map((role) => (
                            <SwiperSlide key={role.key}>
                                <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col hover:shadow-lg hover:border-gray-200 transition-all duration-300 h-auto group">
                                    {/* Icon */}
                                    <div className="mb-5">
                                        <div className={`inline-flex items-center justify-center w-14 h-14 ${role.iconBg} rounded-xl group-hover:scale-110 transition-transform`}>
                                            <span className={`material-symbols-outlined text-3xl ${role.iconColor}`}>
                                                {role.icon}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-xl font-bold text-gray-900 mb-5">
                                        {t(`solutions.roles.${role.key}.title`)}
                                    </h3>

                                    {/* Content */}
                                    <div className="space-y-5 flex-grow">
                                        {/* Concern */}
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">
                                                Quan tâm nhất
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                {t(`solutions.roles.${role.key}.concern`)}
                                            </p>
                                        </div>

                                        {/* Tools */}
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">
                                                Bạn sẽ dùng
                                            </div>
                                            <ul className="space-y-1.5">
                                                {Object.keys(
                                                    t(`solutions.roles.${role.key}.tools`, { returnObjects: true }) as Record<
                                                        string,
                                                        string
                                                    >
                                                ).map((toolKey) => (
                                                    <li key={toolKey} className="flex items-start gap-2 text-sm text-gray-700">
                                                        <span className="w-1 h-1 bg-electric-teal rounded-full mt-1.5 flex-shrink-0"></span>
                                                        <span>{t(`solutions.roles.${role.key}.tools.${toolKey}`)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Metric */}
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">
                                                Chỉ số
                                            </div>
                                            <div className="text-electric-teal font-semibold text-base">
                                                {t(`solutions.roles.${role.key}.metric`)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <div className="mt-6 pt-5 border-t border-gray-100">
                                        <button className="text-sm font-semibold text-electric-teal hover:text-electric-blue flex items-center gap-1 hover:gap-2 transition-all group/btn">
                                            {t(`solutions.roles.${role.key}.cta`)}
                                            <span className="material-symbols-outlined text-base group-hover/btn:translate-x-0.5 transition-transform">
                                                arrow_forward
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                {/* Instructions */}
                <div className="text-center mt-8">
                    <p className="text-gray-400 text-sm flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">swipe</span>
                        Kéo để xem thêm hoặc đợi tự động chuyển
                    </p>
                </div>
            </div>

            {/* Custom Swiper Styles */}
            <style jsx global>{`
                .role-swiper {
                    width: 100%;
                    padding-top: 10px;
                }

                .role-swiper .swiper-wrapper {
                    padding-bottom: 10px;
                }

                .role-swiper .swiper-pagination {
                    bottom: 0;
                }

                .role-swiper .swiper-pagination-bullet {
                    background: #cbd5e1;
                    width: 8px;
                    height: 8px;
                    opacity: 1;
                    transition: all 0.3s ease;
                    margin: 0 4px;
                }

                .role-swiper .swiper-pagination-bullet-active {
                    background: #14b8a6;
                    width: 24px;
                    border-radius: 4px;
                }

                .role-swiper .swiper-button-next,
                .role-swiper .swiper-button-prev {
                    color: white;
                    background: #14b8a6;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(20, 184, 166, 0.3);
                }

                .role-swiper .swiper-button-next:hover,
                .role-swiper .swiper-button-prev:hover {
                    background: #0d9488;
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
                }

                .role-swiper .swiper-button-next::after,
                .role-swiper .swiper-button-prev::after {
                    font-size: 20px;
                    font-weight: 900;
                }

                .role-swiper .swiper-button-disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                @media (max-width: 1024px) {
                    .role-swiper .swiper-button-next,
                    .role-swiper .swiper-button-prev {
                        width: 40px;
                        height: 40px;
                    }

                    .role-swiper .swiper-button-next::after,
                    .role-swiper .swiper-button-prev::after {
                        font-size: 16px;
                    }
                }

                @media (max-width: 640px) {
                    .role-swiper .swiper-button-next,
                    .role-swiper .swiper-button-prev {
                        width: 36px;
                        height: 36px;
                    }

                    .role-swiper .swiper-button-next::after,
                    .role-swiper .swiper-button-prev::after {
                        font-size: 14px;
                    }
                }
            `}</style>
        </section>
    );
}
