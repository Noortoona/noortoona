// Bounded header parsing only. Uploaded raster images never become executable markup.
export function rasterDimensions(bytes,mime){
  let width=0,height=0;
  if(mime==='png'&&bytes.length>=24&&bytes.subarray(12,16).toString()==='IHDR'){
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  }else if(mime==='jpeg'){
    let offset=2;
    while(offset+3<bytes.length){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(offset+2>bytes.length)break;
      const size=bytes.readUInt16BE(offset);if(size<2||offset+size>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
      offset+=size;
    }
  }else if(mime==='webp'&&bytes.length>=30){
    const chunk=bytes.subarray(12,16).toString();
    if(chunk==='VP8 '&&bytes.subarray(23,26).toString('hex')==='9d012a'){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}
    else if(chunk==='VP8L'&&bytes[20]===47){const bits=bytes.readUInt32LE(21);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
    else if(chunk==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}
  }
  if(!width||!height||width>10000||height>10000||width*height>20000000)throw Object.assign(new Error('أبعاد الصورة غير صالحة أو تتجاوز 20 ميجابكسل'),{status:400});
  return {width,height};
}
