<?php
namespace Bolt\Extension\CND\ImageService;
use Bolt;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Controller\ImageController;
use Bolt\Extension\CND\ImageService\Provider\FieldProvider;
use Bolt\Extension\CND\ImageService\Provider\ServiceProvider;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Bolt\Extension\SimpleExtension;
use Bolt\Asset\File\JavaScript;
use Bolt\Asset\File\Stylesheet;
use Bolt\Controller\Zone;

class Extension extends SimpleExtension
{
    CONST APP_EXTENSION_KEY = "cnd.image-service";

    /**
     * {@inheritdoc}
     */
    public function getServiceProviders()
    {
        return [
            $this,
            new FieldProvider(),
            new ServiceProvider($this->getConfig())
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function registerFields() {
        return [
            new Bolt\Extension\CND\ImageService\Field\ImageServiceListField()
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerAssets(){
    
        $resources    = $this->container['resources'];
        $extensionUrl = $resources->getUrl('bolt').'image-service';
        $jsName       = $this->getContainer()["debug"] ? '/js/extension.js': '/js/extension.min.js';
        $config       = $this->imageConfig();
    
        return [
            // js
            (new JavaScript($jsName))
                ->setZone(Zone::BACKEND)
                ->setAttributes(['data-extension-url="'.$extensionUrl.'"', 'data-default-servicename="'.$config['defaultService'].'"'])
                ->setPriority(1),
            // css
            (new Stylesheet('/css/extension.css'))->setZone(Zone::BACKEND)->setPriority(1),
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigPaths(){
        return ['templates','templates/structured-content'];
    }
    
    /**
     * {@inheritdoc}
     */
    protected function registerTwigFunctions(){
        return [
            'imageservice'       => "imageUrlFilter",
            'imageserviceConfig' => "imageConfig",
            'thumbnail'          => "thumbnailOverride"
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigFilters(){
        return [
            'thumbnail'          => "thumbnailOverride"
        ];
    }

    /**
     * Delivers the extensions config to the template
     * @return array
     */
    public function imageConfig() {
        
        $config = $this->getConfig();
        
        return [
            "defaultService" => $config['defaults']['connector'],
            "image"          => $config['defaults']['image'],
            "security"       => $config['security']
        ];
    }


    public function imageUrlFilter($image, $width, $height, $mode = false, $format = false, $quality = false, $options = array()) {

        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        /* @var ImageService $service */
        $service = $app[self::APP_EXTENSION_KEY.".service"];

        if(is_object($image)) {
            $image = Image::create([
                "id" => $image->id,
                "service" => $image->service
            ]);
        } elseif(isset($image['id']) && isset($image['service'])) {
            $image = Image::create([
                "id" => $image['id'],
                "service" => $image['service']
            ]);
        } else {
            return "";
        }

        return $service->imageUrl( $image, $width, $height, $mode, $format, $quality, $options );
    }

    public function thumbnailOverride($input = null, $width = null, $height = null, $crop = null, $format = false) {

        $crop_map = [
            'limit' => 'r',  # Resize (Scaling up is controlled for the "r" option in general in config.yml thumbnails/upscale)
            'fit' => 'r',  # Resize
            'scale' => 'f', # Fit (Bolt will not use "c" automatically if only one dimension is given)
            'fill' => 'c', # Crop
            'pad' => 'b' # Borders
        ];

        $image = $this->imageUrlFilter($input, $width, $height, $crop, $format);

        if(!$image)
            $image = $this->container['twig.handlers']['image']->thumbnail($input, $width, $height, $crop_map[$crop]);

        return $image;
    }

    /**
     * {@inheritdoc}
     */
    protected function registerMenuEntries()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        /* @var ImageService $service */
        $service = $app[self::APP_EXTENSION_KEY.".service"];

        return $service->getServiceMenu();
    }

    /**
     * {@inheritdoc}
     */
    protected function registerBackendControllers()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        $config = $this->getConfig();

        // Registers the new permissions that the controller will need
        $this->addAccessControl();

        return [
            '/image-service/image' => new ImageController($app, $config),
        ];
    }

    /**
     * Adds a new permission, and assign it to the configured groups
     */
    protected function addAccessControl() {

        $app    = $this->container;
        $config = $this->getConfig();
        $roles  = $config['permissions']['roles'];

        $permissions = $app['config']->get('permissions/global');

        $permissions[ImageController::PERMISSION_EDIT] = $roles['edit'];
        $permissions[ImageController::PERMISSION_VIEW] = $roles['view'];

        $app['config']->set('permissions/global', $permissions);

    }

}
