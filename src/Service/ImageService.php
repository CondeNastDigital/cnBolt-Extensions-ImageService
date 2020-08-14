<?php
namespace Bolt\Extension\CND\ImageService\Service;
use Bolt;
use Silex\Application;
use Bolt\Extension\CND\ImageService\IConnector;
use Bolt\Extension\CND\ImageService\Image;

class ImageService {

    /* @var IConnector[] $connectors */
    protected $connectors = array();

    /**
     * Set up the object.
     *
     * @param Application $app
     * @param array              $config
     */
    public function __construct(Application $app, $config) {
        $this->container = $app;
        $this->config = $config;

        // Init service connectors
        foreach($this->config["connectors"] as $key => $config){

            if(!isset($config["class"]))
                continue;

            if(!class_exists($config["class"]))
                continue;

            $connector = new $config["class"]($app, $config);
            if(!$connector instanceof IConnector)
                continue;

            $this->connectors[$key] = $connector;
        }
    }

    /**
     * @return array
     */
    public function getServiceMenu(){
        $entries = [];

        foreach($this->connectors as $connector){
            $entries = $entries + $connector->adminGlobal();
        }

        return $entries;
    }

    /**
     * return an url to the image with specified sizes and formats
     * @param Image $image
     * @param int|string $width    Depending on variable type, the call is either with specific sizes or with an alias string
     * @param bool|int $height
     * @param bool|string $mode
     * @param bool|string $format
     * @param bool|int $quality
     * @param array $options
     * @return null|string
     */
    public function imageUrl(Image $image, $width, $height = false, $mode = false, $format = false, $quality = false, $options = array()){
        try {
            return $this->imageUrlGenerate($image, $width, $height, $mode, $format, $quality, $options);
        }
        catch( \Exception $e){
            return $this->container['twig.runtime.bolt_image']->thumbnail('unknown', $width, $height, 'c');
        }
    }

    /**
     * return an url to the image with specified sizes and formats
     * @param Image $image
     * @param int|string $width    Depending on variable type, the call is either with specific sizes or with an alias string
     * @param bool|int $height
     * @param bool|string $mode
     * @param bool|string $format
     * @param bool|int $quality
     * @param array $options
     * @return null|string
     */
    public function imageUrlGenerate(Image $image, $width, $height = false, $mode = false, $format = false, $quality = false, $options = array()){
        $defaults = $this->config["defaults"]['image'];

        $mode    = $mode    ? $mode    : $defaults["mode"];
        $format  = $format  ? $format  : $defaults["format"];
        $quality = $quality ? $quality : $defaults["quality"];
        $options = $options ? $options : [];

        $options = $options + $defaults["options"];

        if(!$image->service || !$image->id || !isset($this->connectors[$image->service]))
            return null;

        /* @var IConnector $connector */
        $connector = $this->connectors[$image->service];

        return $connector->imageUrl($image, $width, $height, $mode, $format, $quality, $options);
    }

    /**
     * Update, delete or create all sent images according to their status
     * Will look inside $_FILES (or the Silex equivalent) for needed files
     * @param Image[] $images
     * @param array $messages
     * @return bool
     */
    public function imageProcess(array $images, &$messages = []){

        // Sort images by service
        $services = [];
        foreach($images as $image ){
            if($image->service && $image->status && isset($this->connectors[$image->service])){

                if(!isset($services[$image->service]))
                    $services[$image->service] = [];

                $services[$image->service][] = $image;
            }
        }

        // Send images to services
        $results = [];
        foreach($services as $key => $images){
            $service = $this->connectors[$key];
            $images = $service->imageProcess($images, $messages);
            $results = array_merge($results, $images);
        }

        return $results;
    }

    /**
     * Search for images in all connected image services
     * @param string $search
     * @return Image[]
     */
    public function imageSearch($search){

        $images = [];

        /* @var IConnector $connector */
        foreach($this->connectors as $key => $connector) {
            $images = array_merge($images, $connector->imageSearch($search));
        }

        return $images;
    }

    /**
     * Search for images in all connected image services
     * @param string $search
     * @return Image[]
     */
    public function tagSearch($search){

        $images = [];

        /* @var IConnector $connector */
        foreach($this->connectors as $key => $connector) {
            $images = array_merge($images, $connector->tagSearch($search));
        }

        return $images;
    }

    public function getConfig(){
        return $this->config;
    }

    /**
     * Generate imageinfo array as returned by Bolt's imageinfo filter
     * Optionally add with/height/aspect or image if cropped
     * @param Image $image
     * @param bool $width
     * @param bool $height
     * @param bool $mode
     * @return array
     */
    public function imageInfo(Image $image, $width = false, $height = false, $mode = false, $format = false, $quality = false, $options = array()){

        if(!$image->service || !$image->id || !isset($this->connectors[$image->service]))
            return null;

        /* @var IConnector $connector */
        $connector = $this->connectors[$image->service];
        $info = $connector->imageInfo($image);

        if($info && $width) {
            $defaults = $this->config["defaults"]['image'];
            $mode = $mode ? $mode : $defaults["mode"];

            $info['cropped'] = $this->calculateCrop($info, $image, $width, $height, $mode, $format, $quality, $options);
        }

        return $info;
    }

    /**
     * Calculate theoretical cropped dimensions
     * @param $info
     * @param $image
     * @param $width
     * @param $height
     * @param $mode
     * @param $format
     * @param $quality
     * @param $options
     * @return array|bool
     * @throws \Exception
     */
    protected function calculateCrop($info, $image, $width, $height, $mode, $format, $quality, $options){

        // Alias
        if($width && !$height) {
            $config = $this->resolveAlias($width);

            $width = $config['width'];
            $height = $config['height'];
            $mode = $config['cropping'];
            $format = $config['format'];
            $quality = $config['quality'];
            $options = $config['options'];
        }

        switch ($mode){
            // Same as fit but only if image is larger than width/height
            case IConnector::MODE_LIMIT:
                if($width > $info['width'] && $height > $info['height']) {
                    $calcwidth = $info['width'];
                    $calcheight = $info['height'];
                    break;
                }
                // -> Continue to FIT

            // Image is resized to take up as much space as possible within bounding box defined by width and height
            case IConnector::MODE_FIT:
                $heightFactor = $height / $info['height'];
                $widthFactor = $width / $info['width'];
                $scaleFactor = min($widthFactor, $heightFactor);
                $calcwidth = ceil($info['width']*$scaleFactor);
                $calcheight = ceil($info['height']*$scaleFactor);
                break;

            // Create image with exact given width and height without distorting the image
            case IConnector::MODE_FILL:
            // Change size of image exactly to given width and height without retaining aspect ratio
            case IConnector::MODE_SCALE:
                $calcwidth = $width;
                $calcheight = $height;
                break;

            default:
                return false;
        }

        return [
            'width' => $calcwidth,
            'height' => $calcheight,
            'aspectratio' => $calcwidth && $calcheight ? round($calcwidth/$calcheight,2) : false,
            'landscape' => $calcwidth > $calcheight,
            'portrait' => $calcwidth < $calcheight,
            'square' => $calcwidth == $calcheight,
            'url' => $this->imageUrlGenerate($image, $width, $height, $mode, $format, $quality, $options)
        ];
    }

    /**
     * @param string $alias
     * @return array
     * @throws \Exception
     */
    public function resolveAlias($alias){
        $aliasConfig = $this->container['config']->get('theme/thumbnails/aliases', []);
        $imageConfig = $this->getConfig();

        if(!isset($aliasConfig[$alias]))
            throw new \Exception('Invalid alias "'.$alias.'" specified');

        $config = $aliasConfig[$alias] + ($imageConfig['defaults']['image'] ?? []);

        // Bolt crop modes (short or long notation) need to be translated to ImageService modes
        $mode = substr($config['cropping'],0,1);
        $config['cropping'] = Bolt\Extension\CND\ImageService\Extension::$CROP_MAP[$mode] ?? IConnector::MODE_LIMIT;

        return [
            'width' => $config['size'][0] ?? false,
            'height' => $config['size'][1] ?? false,
            'cropping' => $config['cropping'] ?? false,
            'format' => $config['format'] ?? false,
            'quality' => $config['quality'] ?? false,
            'options' => $config['options'] ?? false,
        ];
    }

}
