/**
 * Created by NAVER on 2016-04-20.
 */
var canvas, context;
var imgLoader, originImg;
var currentTime, deltaTime;
var showProgress;
var width, height;
var processingBtn;

function Point(){
    this.x = 0;
    this.y = 0;
}

function getProcessTime(target)
{
    deltaTime = Date.now() - currentTime;
    currentTime = Date.now();
    document.getElementById("output").innerHTML +=target + ": " + deltaTime + "ms" +"<br>";
}
function clearLog()
{
    document.getElementById("output").innerHTML = "";
}
function houghTransform( img, rho_res, theta_res, threshold ) {
    var image = img.data;

    var width = img.cols;
    var height = img.rows;
    var step = width;

    min_theta = 0.0;
    max_theta = Math.PI;

    numangle = Math.round((max_theta - min_theta) / theta_res);
    numrho = Math.round(((width + height) * 2 + 1) / rho_res);
    irho = 1.0 / rho_res;

    var accum = new Int32Array((numangle+2) * (numrho+2)); //typed arrays are initialized to 0
    var tabSin = new Float32Array(numangle);
    var tabCos = new Float32Array(numangle);

    var n=0;
    var ang = min_theta;
    for(; n < numangle; n++ ) {
        tabSin[n] = Math.sin(ang) * irho;
        tabCos[n] = Math.cos(ang) * irho;
        ang += theta_res
    }

    // stage 1. fill accumulator
    for( var i = 0; i < height; i++ ) {
        for( var j = 0; j < width; j++ ) {
            if( image[i * step + j] != 0 ) {
                //console.log(r, (n+1) * (numrho+2) + r+1, tabCos[n], tabSin[n]);
                for(var n = 0; n < numangle; n++ ) {
                    var r = Math.round( j * tabCos[n] + i * tabSin[n] );
                    r += (numrho - 1) / 2;
                    accum[(n+1) * (numrho+2) + r+1] += 1;
                }
            }
        }
    }

    // stage 2. find local maximums
    //TODO: Consider making a vector class that uses typed arrays
    _sort_buf = new Array();
    for(var r = 0; r < numrho; r++ ) {
        for(var n = 0; n < numangle; n++ ) {
            var base = (n+1) * (numrho+2) + r+1;
            if( accum[base] > threshold &&
                accum[base] > accum[base - 1] && accum[base] >= accum[base + 1] &&
                accum[base] > accum[base - numrho - 2] && accum[base] >= accum[base + numrho + 2] ) {
                _sort_buf.push(base);
            }
        }
    }

    // stage 3. sort the detected lines by accumulator value
    _sort_buf.sort(function(l1, l2) {
        return accum[l1] > accum[l2] || (accum[l1] == accum[l2] && l1 < l2);
    });

    // stage 4. store the first min(total,linesMax) lines to the output buffer
    linesMax = Math.min(numangle*numrho, _sort_buf.length);
    scale = 1.0 / (numrho+2);
    lines = new Array();
    for( var i = 0; i < linesMax; i++ ) {
        var idx = _sort_buf[i];
        var n = Math.floor(idx*scale) - 1;
        var r = idx - (n+1)*(numrho+2) - 1;
        var lrho = (r - (numrho - 1)*0.5) * rho_res;
        var langle = n * theta_res;
        lines.push([lrho, langle]);
    }
    return lines;
}

function init()
{
    console.log("hello");
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');

    imgLoader = document.getElementById('imageLoader');
    imgLoader.addEventListener('change', uploadImage, false);

    var progressCheckbox = document.getElementById('showProgress');
    showProgress = progressCheckbox.checked;
    progressCheckbox.addEventListener('click', clickProgressCheckbox);

    processingBtn = document.getElementById('processingImage');
    processingBtn.addEventListener('click', clickProcessing);
    processingBtn.disabled = true;

}

function uploadImage(e)
{
    console.log(e);
    var reader = new FileReader();
    reader.onload = function(event){
        var img = new Image();
        img.onload = function(){
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);

            processingBtn.disabled = false;
        };
        img.src = event.target.result;
        originImg = img;
    };
    reader.readAsDataURL(e.target.files[0]);
}

function clickProgressCheckbox(e)
{
    console.log(e.target.checked);
    showProgress = e.target.checked;
}

var width,height;
var imageData;
var data_buffer;
var grayImg;

function clickProcessing(e)
{
    console.log('do processing');
    width = canvas.width;
    height = canvas.height;

    currentTime = Date.now();
    //grayscale -> canny -> houghtransform
    imageData = context.getImageData(0, 0, width, height);
    // data_buffer = new jsfeat.data_t(width * height);
    grayImg = new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t);
    jsfeat.imgproc.grayscale(imageData.data, width, height, grayImg);
    getProcessTime("gray");

    var blurLevel = 2;
    var lowThreshhold = 40;
    var highThreshhold = 100;
    //Gaussian Blur to reduce noise
    var r = blurLevel | 0;
    var kernel_size = (r + 1) << 1;
    jsfeat.imgproc.gaussian_blur(grayImg, grayImg, kernel_size, 0);

    //Reduce image to edges
    jsfeat.imgproc.canny(grayImg, grayImg, lowThreshhold | 0, highThreshhold | 0);
    getProcessTime("canny");

    var data_u32 = new Uint32Array(imageData.data.buffer);
    var alpha = (0xff << 24);
    var i = grayImg.cols*grayImg.rows, pix = 0;
    while(--i >= 0) {
        pix = grayImg.data[i];
        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;

    }
    //hough transform

    var threshold = document.getElementById('threshold').value;
    console.log(threshold);
    var lines = houghTransform(grayImg, 1, Math.PI / 180, threshold);


    var angle = 0;
    var lineCount = lines.length;

    for(var i = 0; i < lines.length; i += 1)
    {
        var rho = lines[i][0];
        var theta = lines[i][1];
        var a = Math.cos(theta), b = Math.sin(theta);
        var x0 = a * rho, y0 = b*rho;
        var pt1 = new Point();
        var pt2 = new Point();
        pt1.x = Math.round(x0 + 1000 * (-b));
        pt1.y = Math.round(y0 + 1000 * (a));
        pt2.x = Math.round(x0 - 1000 * (-b));
        pt2.y = Math.round(y0 - 1000 * (a));
        angle += Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180/ Math.PI;

    }
    getProcessTime("hough transform");
    console.log("target angle: ", angle / lineCount);
    document.getElementById("output").innerHTML += "target angle: " + (angle / lineCount) + "<br>";
    //if show Progress is true, draw result image
    if(showProgress)
    {
        // render result back to canvas
        var data_u32 = new Uint32Array(imageData.data.buffer);
        var alpha = (0xff << 24);
        var i = grayImg.cols*grayImg.rows, pix = 0;
        while(--i >= 0) {
            pix = grayImg.data[i];
            data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;

        }
        // Put the edited image on the canvas
        context.putImageData(imageData, 0, 0);
        var color = '#ff0000';
        context.strokeStyle = color;
        context.lineWidth = 0.5;

        for(var i = 0; i < lineCount; i += 1)
        {
            var rho = lines[i][0];
            var theta = lines[i][1];
            var a = Math.cos(theta), b = Math.sin(theta);
            var x0 = a * rho, y0 = b*rho;
            var pt1 = new Point();
            var pt2 = new Point();
            pt1.x = Math.round(x0 + 1000 * (-b));
            pt1.y = Math.round(y0 + 1000 * (a));
            pt2.x = Math.round(x0 - 1000 * (-b));
            pt2.y = Math.round(y0 - 1000 * (a));

            context.save();
            context.beginPath();
            context.moveTo(pt1.x, pt1.y);
            context.lineTo(pt2.x, pt2.y);
            context.stroke();
            context.restore();

        }

        getProcessTime("render");
    }
}


window.onload = init;