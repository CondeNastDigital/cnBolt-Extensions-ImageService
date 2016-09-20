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
    protected function registerAssets(){

        $resources    = $this->container['resources'];
        $extensionUrl = $resources->getUrl('bolt').'image-service';

        return [
            // js
            (new JavaScript('/js/extension.js'))->setZone(Zone::BACKEND)->setPriority(1),
            (new JavaScript('/js/extension-for/sir-trevor.js'))
                ->setZone(Zone::BACKEND)
                ->setAttributes(['data-extension-url="'.$extensionUrl.'"'])
                ->setPriority(2),
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
            'imageservice' => [[$this->getContainer()[self::APP_EXTENSION_KEY.".service"], "imageUrl" ]]
        ];
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
        return [
            '/image-service/image' => new ImageController($app, $config),
        ];
    }
}