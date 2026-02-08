import { ReactElement } from 'react';


import PublicLayout from '@/components/layout/PublicLayout';
import ProductHero from '@/components/pages/product/sections/ProductHero';
import ProductFeatures from '@/components/pages/product/sections/ProductFeatures';
import { ProductCTA, ProductFAQ } from '@/components/pages/product/sections/ProductOtherSections';
import SeoHead from '@/components/common/SeoHead';

const ProductPage = () => {
  return (
    <>
      <SeoHead
        title="Sản phẩm Nemark Inbox - Live Chat & CRM"
        description="Một nền tảng live chat giúp bạn thu lead và chốt nhanh. Không bỏ sót hội thoại nào. Trang bị cho đội Sales & CSKH công cụ mạnh mẽ nhất."
        canonical="https://nemark.com/product"
      />


      {/* Hero Section */}
      <ProductHero />

      {/* Main Features Grid (Sidebar + Sections) */}
      <ProductFeatures />

      {/* FAQ Section */}
      <ProductFAQ />

      {/* CTA Section */}
      <ProductCTA />
    </>
  );
};

ProductPage.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default ProductPage;
