<?php
namespace Bolt\Extension\CND\ImageService\Controller;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Bolt\Users;
use Silex\Application;
use Silex\ControllerCollection;
use Silex\ControllerProviderInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\Security\Core\User\User;
use Bolt\Extension\CND\ImageService\IConnector;

/**
 * The controller
 */
class ImageController implements ControllerProviderInterface
{

    /** @var Application */
    protected $container;

    /* Permissions */
    CONST PERMISSION_EDIT = 'cnd-imageservice-edit';
    CONST PERMISSION_VIEW = 'cnd-imageservice-view';

    /**
     * {@inheritdoc}
     */
    public function connect(Application $app)
    {
        $this->container = $app;

        /** @var ControllerCollection $ctr */
        $ctr = $app['controllers_factory'];

        $ctr->get('/imagesearch', [$this, 'imageSearch']);
        $ctr->post('/imageprocess', [$this, 'imageProcess']);
        $ctr->get('/tagsearch', [$this, 'tagSearch']);
        $ctr->get('/imageurl', [$this, 'imageUrl']);

        return $ctr;
    }


    /**
     * Gets an image url
     * @param Request $request
     * @return JsonResponse
     */
    public function imageUrl(Request $request) {

        // TODO: Create a MessageClass that hold the common constants and logic
        if(!$this->canAccess(self::PERMISSION_VIEW))
            return new JsonResponse([
                "url" => null,
                "messages" => [[
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ACCESSDENIED,
                    "id" => null
                ]],
                "success" => false
            ]);

        $imageId = $request->get('imageid');
        $service = $request->get('service');
        $width   = $request->get('width');
        $height  = $request->get('height');

        if(!$imageId)
            return new JsonResponse([
                "success" => false
            ]);

        $image = Image::create([
            'id' => $imageId,
            'service' => $service
        ]);

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        $result = $service->imageUrl($image, $width, $height);

        return new JsonResponse([
            "url" => $result,
            "messages" => [],
            "success" => true
        ]);
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function imageProcess(Request $request)
    {

        // TODO: Create a MessageClass that hold the common constants and logic
        if(!$this->canAccess(self::PERMISSION_EDIT))
            return new JsonResponse([
                "items" => [],
                "messages" => [[
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ACCESSDENIED,
                    "id" => null
                ]],
                "success" => false
            ]);

        $messages = [];
        $items = $request->get('items');
        $items = json_decode($items, true);

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        if(!is_array($items))
            return new JsonResponse([
                "success" => false
            ]);

        $images = [];
        foreach($items as $item)
            $images[] = Image::create($item);

        $images = $service->imageProcess($images, $messages);

        return new JsonResponse([
            "items" => $images,
            "messages" => $messages,
            "success" => true
        ]);

    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function imageSearch(Request $request)
    {
        // TODO: Create a MessageClass that hold the common constants and logic
        if(!$this->canAccess(self::PERMISSION_VIEW))
            return new JsonResponse([
                "search" => '',
                "items"  => [],
                "messages" => [[
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ACCESSDENIED,
                    "id" => null
                ]],
                "success" => false
            ]);

        $text = $request->get('q','');
        $text = strip_tags(urldecode($text));

        $images = [];

        if(trim($text)) {
            /* @var ImageService $service */
            $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

            $images = $service->imageSearch($text);
        }

        return new JsonResponse([
            "search" => $text,
            "items" => $images,
            "success" => true,
            "messages" => []
        ]);
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function tagSearch(Request $request)
    {
        $text = $request->get('q','');
        $text = strip_tags(urldecode($text));

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        $images = $service->tagSearch($text);

        return new JsonResponse([
            "search" => $text,
            "items" => $images,
            "success" => true
        ]);
    }

    /**
     * @param string $permission Possible values: editcontent,deletecontent,contentaction,overview,relatedto
     * @return bool
     * @internal param string $role
     * @internal param Application $app
     * @internal param Request $request
     */
    private function canAccess($permission)
    {
        $app  = $this->container;
        $user = $app['users']->getCurrentUser();

        return $app['permissions']->isAllowed($permission, $user);
    }
}