export default function Adapter(code: string) {
  let bidderCode = code;

  function setBidderCode(code: string) {
    bidderCode = code;
  }

  function getBidderCode() {
    return bidderCode;
  }

  function callBids() {
  }

  return {
    callBids: callBids,
    setBidderCode: setBidderCode,
    getBidderCode: getBidderCode
  };
}
