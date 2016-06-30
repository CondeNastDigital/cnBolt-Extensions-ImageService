<?php
namespace Bolt\Extension\CND\ImageService\Service;
use Bolt;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Connector\IConnector;
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

    public function getServiceMenu(){
        $entries = [];

        foreach($this->connectors as $connector){
            $entries = $entries + $connector->adminGlobal();
        }

        return $entries;
    }

    public function imageUrl(Image $image, $width, $height, $mode = false, $format = false, $quality = false, $options = array()){
        $defaults = $this->config["defaults"];

        $mode    = $mode    ? $mode    : $defaults["mode"];
        $format  = $format  ? $format  : $defaults["format"];
        $quality = $quality ? $quality : $defaults["quality"];
        $options = $options ? $options : $defaults["options"];

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
     * @return bool
     */
    public function imageProcess(array $images){

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
            $images = $service->imageProcess($images);
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

}