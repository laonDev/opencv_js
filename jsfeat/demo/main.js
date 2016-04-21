/**
 * Created by NAVER on 2016-04-20.
 */
var canvas, context;
var imgLoader, originImg;

function init()
{
    console.log("hello");
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');

    imgLoader = document.getElementById('imageLoader');
    imgLoader.addEventListener('change', uploadImage, false);


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

        };
        img.src = event.target.result;
        originImg = img;
    };
    reader.readAsDataURL(e.target.files[0]);
}

window.onload = init;