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
use Bolt\Response\TemplateView;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpKernel\Event\KernelEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class Extension extends SimpleExtension
{
    CONST APP_EXTENSION_KEY = "cnd.image-service";

    protected static $CROP_MAP = [
        'r' => 'limit',  # Resize (Scaling up is controlled for the "r" option in general in config.yml thumbnails/upscale)
        'f' => 'scale', # Fit (Bolt will not use "c" automatically if only one dimension is given)
        'c' => 'fill', # Crop
        'b' => 'pad'  # Borders
    ];

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


    public function registerNutCommands(\Pimple $container){

        $migrate = new Bolt\Extension\CND\ImageService\Command\MigrateCommand('migrate');
        $migrate->setApp($this->getContainer());

        return [
            $migrate
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
            'thumbnail'          => "thumbnailOverride",
            'imageinfo'          => "imageinfoOverride",
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigFilters(){
        return [
            'thumbnail'          => "thumbnailOverride",
            'imageinfo'          => "imageinfoOverride",
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

    /**
     * return an url to the image with specified sizes and formats
     * @param Image $input
     * @param int|string $width    Depending on variable type, the call is either with specific sizes or with an alias string
     * @param bool|int $height
     * @param bool|string $mode
     * @param bool|string $format
     * @param bool|int $quality
     * @param array $options
     * @return null|string
     */
    public function imageUrlFilter($input, $width, $height = false, $mode = false, $format = false, $quality = false, $options = array()) {
        /* @var ImageService $service */
        $service = $this->getContainer()[self::APP_EXTENSION_KEY.".image"];

        $image = $this->fixImage($input);
        iF(!$image)
            return '';

        return $service->imageUrl( $image, $width, $height, $mode, $format, $quality, $options );
    }

    /**
     * This twig filter overrides Bolt's built-in filter. It calls this services
     * imageUrl method or relays back to Bolt's own thumbnail filter if not applicable.
     * @param null $input
     * @param null $width
     * @param null $height
     * @param null $crop
     * @param bool $format
     * @param bool $quality
     * @param array $options
     * @return bool|null|string
     */
    public function thumbnailOverride($input = null, $width = null, $height = null, $crop = null, $format = null, $quality = null, $options = array()) {

        $image = false;
        $thumbservice = $this->getThumbnailService();

        try {
            /* @var ImageService $service */
            $service = $this->getContainer()[self::APP_EXTENSION_KEY . ".image"];

            $image = $this->fixImage($input);
            if($image)
                $image = $service->imageUrlGenerate($image, $width, $height, $crop ? self::$CROP_MAP[$crop] : null, $format, $quality, $options);

        } catch (\Exception $e) {
            return $thumbservice->thumbnail('unknown', $width, $height, $crop);
        }

        // Fallback to Bolt's standard thumbnail generator
        if(!$image){
            $image = $thumbservice->thumbnail($input, $width, $height, $crop);
        }

        return $image;
    }

    /**
     * This twig filter overrides Bolt's built-in filter. It calls this services
     * imageUrl method or relays back to Bolt's own thumbnail filter if not applicable.
     * @param null $input
     * @param null $width
     * @param null $height
     * @param null $crop
     * @param bool $format
     * @param bool $quality
     * @param array $options
     * @return bool|null|string
     */
    public function imageinfoOverride($input = null, $width = null, $height = null, $crop = null) {

        $image = false;
        $thumbservice = $this->getThumbnailService();

        try {
            /* @var ImageService $service */
            $service = $this->getContainer()[self::APP_EXTENSION_KEY . ".image"];

            $image = $this->fixImage($input);
            if($image)
                $image = $service->imageInfo($image, $width, $height, $crop ? self::$CROP_MAP[$crop] : null);

        } catch (\Exception $e) {
            return false;
        }

        // Fallback to Bolt's standard thumbnail generator
        if(!$image){
            $image = $thumbservice->imageInfo($input);
        }

        return $image;
    }

    /**
     * @param array|Image|object $image
     * @return Image|bool
     */
    protected function fixImage($image){
        // Already a valid image object
        if ($image instanceof Image)
            return $image;


        // A std object or unhydrated converted json
        if(is_object($image))
            return Image::create([
                "id" => $image->id,
                "service" => $image->service
            ]);

        // An unhydrated array
        if(isset($image['id']) && isset($image['service']))
            return Image::create([
                "id" => $image['id'],
                "service" => $image['service']
            ]);

        return false;
    }

    /**
     * Get the right Thumbnail service for Bolt's various versions
     * @return bool|Bolt\Twig\Runtime\ImageRuntime
     */
    protected function getThumbnailService(){
        // Bolt 3.3+
        if(isset($this->container['twig.runtime.bolt_image']))
            return $this->container['twig.runtime.bolt_image'];

        // Bolt 3.0 - 3.2
        if(isset($this->container['twig.handlers']['image']))
            return $this->container['twig.handlers']['image'];

        // Not compatible
        return false;
    }

    /**
     * {@inheritdoc}
     */
    protected function registerMenuEntries()
    {
        /* @var \Bolt\Application $app */
        $app = $this->getContainer();
        /* @var ImageService $service */
        $service = $app[self::APP_EXTENSION_KEY.".image"];

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

    public function subscribe(EventDispatcherInterface $dispatcher) {
        $app = $this->getContainer();

        /**
         * EventListener for "onView"
         * FIX for Bolt's Bug of not calling a field's hydrate method on a preview of a page.
         * Listens for all template render calls on PREVIEW pages and hydrates imageservicelist fields manually
         */
        $dispatcher->addListener(KernelEvents::VIEW, function(KernelEvent $event) use ($app) {

            $result = $event->getControllerResult();
            if (!$result instanceof TemplateView)
                return;

            $route = $event->getRequest()->get('_internal_route', false);
            if($route !== 'preview')
                return;

            $record = $result->getContext()['record'] ?? false;
            if(!$record)
                return;

            foreach($record->contenttype['fields'] as $fieldname => $fieldconfig){
                $type = $fieldconfig['type'] ?? false;
                if($type !== 'imageservicelist')
                    continue;

                $value = $record->get($fieldname);
                if(!$value || is_array($value))
                    continue;

                $record->set($fieldname, json_decode($value,true));
            }

        }, 100);
    }

}
