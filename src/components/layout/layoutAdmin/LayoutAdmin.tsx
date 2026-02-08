// import { useState } from "react";
// import { Navbar } from "../navbar";
// import { Sidebar } from "../sidebar";
// import Footer from "./Footer";
// import { MobileNavbar } from "../navbar/MobileNavbar";
// import { useMyStore } from "@/contexts/MyStoreContext";

// interface LayoutAdminProps {
//   children: React.ReactNode;
// }

// const LayoutAdmin = ({ children }: LayoutAdminProps) => {
//   const [open, setOpen] = useState(false);
//   const { isTablet, isDesktop, sidebarCollapsed, isNoFooter } = useMyStore();

//   return (
//     <div
//       className={`min-h-screen h-full bg-[#f9f9f9]  ${
//         !(isTablet || isDesktop) &&
//         "bg-[url('/assets/img/bg_our_services.png')] bg-no-repeat bg-contain z-[1]"
//       }`}
//     >
//       <div className="block md:flex">
//         {/* Sidebar */}
//         <div className="flex h-[4.5rem]">
//           <Sidebar open={open} setOpen={setOpen} />
//           {/* <div className="flex-1 bg-red w-full">navbar</div>
//            */}
//           <MobileNavbar open={open} setOpen={setOpen} />
//         </div>
//         {/* Content + Navbar */}
//         {/* className={`relative flex-1 flex flex-col min-w-0 ${isTablet ? "" : "bg-transparent" } transition-all duration-300`} */}
//         <div
//           className={`relative flex-1 flex flex-col min-w-0 transition-all duration-300 bg-transparent ${
//             sidebarCollapsed ? "md:ml-20" : "md:ml-[20rem]"
//           }`}
//         >
//           {/* Navbar in desktop */}
//           <Navbar />
//           {/* Main content */}
//           {(isTablet || isDesktop) && (
//             <div
//               className="pointer-events-none absolute right-0 top-[4.5rem] w-full h-[calc(100vh-4.5rem)] bg-[url('/assets/img/bg_our_services.png')] bg-no-repeat bg-contain bg-right-top"
//             />
//           )}
//           {/* min-h-[calc(100vh-4.5rem)] */}
//           <main
//             className={`flex-1 overflow-auto ${
//               isNoFooter ? "min-h-[calc(100vh-4.5rem)]" : "min-h-screen"
//             } `}
//           >
//             {children}
//             {/* Footer inside content area */}
//             {!isNoFooter && <Footer className="!mt-0" />}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LayoutAdmin;
