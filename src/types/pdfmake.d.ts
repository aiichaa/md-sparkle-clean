// Minimal ambient declarations for the pdfmake 0.3 UMD browser builds we import.
// The runtime shape is described in src/lib/md/pdf.ts.
declare module "pdfmake/build/pdfmake" {
  const pdfMake: unknown;
  export default pdfMake;
}
declare module "pdfmake/build/fonts/Roboto" {
  const container: unknown;
  export default container;
}
declare module "pdfmake/build/standard-fonts/Courier" {
  const container: unknown;
  export default container;
}
