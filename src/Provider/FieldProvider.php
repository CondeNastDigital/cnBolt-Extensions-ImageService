<?php

namespace Bolt\Extension\CND\ImageService\Provider;

use Bolt\Extension\CND\ImageService\Field\ImageServiceField;
use Bolt\Extension\CND\ImageService\Field\ImageServiceListField;
use Bolt\Storage\FieldManager;
use Silex\Application;
use Silex\ServiceProviderInterface;

class FieldProvider implements ServiceProviderInterface
{
    public function register(Application $app)
    {
        $app['storage.typemap'] = array_merge(
            $app['storage.typemap'],
            [
                //'imageservice' => ImageServiceField::class, // Not needed as the List can cover the case of single uplaod
                'imageservicelist' => ImageServiceListField::class
            ]
        );

        $app['storage.field_manager'] = $app->share(
            $app->extend(
                'storage.field_manager',
                function (FieldManager $manager) {
                    //$manager->addFieldType('imageservice', new ImageServiceField()); // Not needed as the List can cover the case of single uplaod 
                    $manager->addFieldType('imageservicelist', new ImageServiceListField());
                    return $manager;
                }
            )
        );

    }

    public function boot(Application $app) {
    }
}