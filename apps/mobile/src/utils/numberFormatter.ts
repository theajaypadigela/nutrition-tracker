export const formatIndianNumber = (num: number | string) => {
  return new Intl.NumberFormat('en-IN').format(Number(num));
};
